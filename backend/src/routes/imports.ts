import { Router, type Request, type Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { config } from "../config";
import { chunkRows, hasEmailOrMobile, parseCsv } from "../domain/csv";
import { createAiExtractor, type AiExtractor } from "../ai/client";
import { leadRecordSchema, normalizeLeadRecord, mergeContactFields, type LeadRecord } from "../domain/lead-schema";
import { runWithConcurrency } from "../domain/concurrency";

type UploadedRequest = Request & {
  file?: Express.Multer.File;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadLimitMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isCsv =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/csv" ||
      file.originalname.toLowerCase().endsWith(".csv");
    if (isCsv) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are accepted."));
    }
  },
});

export const importsRouter = Router();

importsRouter.post(
  "/",
  upload.single("file"),
  async (req: UploadedRequest, res: Response, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: "CSV file is required." });
        return;
      }

      const csvText = req.file.buffer.toString("utf8");
      const { rows: rawRows, errors: parseErrors } = parseCsv(csvText);
      const candidateRows: Array<{ row: Record<string, string>; index: number }> = [];
      const skipped: Array<{ source_row_index: number; reason: string }> = [];

      // Track indices of rows already marked as skipped due to parse errors.
      // PapaParse still includes malformed rows in result.data (with empty fields),
      // so without this guard those rows would get a second "no email/mobile" skip entry.
      const parseErrorIndices = new Set<number>();

      parseErrors.forEach((err) => {
        if (err.row >= 0) parseErrorIndices.add(err.row);
        skipped.push({
          source_row_index: err.row,
          reason: `CSV parse warning: ${err.message}`,
        });
      });

      rawRows.forEach((row, index) => {
        if (parseErrorIndices.has(index)) return; // already skipped via parse error

        if (hasEmailOrMobile(row)) {
          candidateRows.push({ row, index });
          return;
        }

        skipped.push({
          source_row_index: index,
          reason: "Skipped because the row contains neither email nor mobile number.",
        });
      });

      if (candidateRows.length === 0) {
        res.json({
          imported: [],
          skipped,
          totals: { imported: 0, skipped: skipped.length, processed: rawRows.length, batches: 0 },
        });
        return;
      }

      let extractor: AiExtractor;
      try {
        extractor = createAiExtractor();
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI provider is not configured.";
        res.status(503).json({ message });
        return;
      }

      const batches = chunkRows(candidateRows, config.batchSize);

      // Run up to 3 batches concurrently to reduce total latency
      const batchTasks = batches.map((batch, batchIndex) => async () => {
        const rowsForAi = batch.map(({ row }) => row);
        return extractor.extractBatch({ rows: rowsForAi, batchNumber: batchIndex + 1 });
      });

      const batchResults = await runWithConcurrency(batchTasks, 3);

      const imported: Array<LeadRecord & { source_row_index: number }> = [];

      batches.forEach((batch, batchIndex) => {
        const result = batchResults[batchIndex];

        if (result.status === "rejected") {
          // Entire batch failed — skip all its rows
          batch.forEach(({ index }) => {
            skipped.push({
              source_row_index: index,
              reason: `AI batch ${batchIndex + 1} failed: ${(result.reason as Error).message}`,
            });
          });
          return;
        }

        const records = result.value;

        batch.forEach(({ row, index }, position) => {
          const record = records[position];
          if (!record) {
            skipped.push({
              source_row_index: index,
              reason: "AI did not return a record for this row.",
            });
            return;
          }

          try {
            const validated = leadRecordSchema.parse(record);
            const merged = mergeContactFields(validated, row);
            const normalized = normalizeLeadRecord(merged);
            imported.push({ ...normalized, source_row_index: index });
          } catch (error) {
            const reason =
              error instanceof ZodError
                ? `Validation failed: ${error.errors.map((e) => e.message).join("; ")}`
                : "Unknown validation error.";
            skipped.push({ source_row_index: index, reason });
          }
        });
      });

      // Sort imported back to original row order
      imported.sort((a, b) => a.source_row_index - b.source_row_index);

      res.json({
        imported,
        skipped,
        totals: {
          imported: imported.length,
          skipped: skipped.length,
          processed: rawRows.length,
          batches: batches.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
