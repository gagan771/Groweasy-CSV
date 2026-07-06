import { Router, type Request, type Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { config } from "../config";
import { chunkRows, hasEmailOrMobile, parseCsv } from "../domain/csv";
import { createAiExtractor, type AiExtractor } from "../ai/client";
import { leadRecordSchema, normalizeLeadRecord, mergeContactFields, type LeadRecord } from "../domain/lead-schema";
import { runWithConcurrency } from "../domain/concurrency";

type UploadedRequest = Request & { file?: Express.Multer.File };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadLimitMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isCsv =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/csv" ||
      file.originalname.toLowerCase().endsWith(".csv");
    if (isCsv) cb(null, true);
    else cb(new Error("Only CSV files are accepted."));
  },
});

/** Write a single SSE event frame. */
function sseWrite(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const importsStreamRouter = Router();

importsStreamRouter.post("/", upload.single("file"), (req: UploadedRequest, res: Response) => {
  // Establish SSE connection
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // prevent nginx buffering
  res.flushHeaders();

  // Keep-alive ping every 20 s to prevent proxy/load-balancer timeouts
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, 20_000);

  req.on("close", () => clearInterval(keepAlive));

  processImport(req, res)
    .catch((err) => {
      if (!res.writableEnded) {
        sseWrite(res, "error", {
          message: err instanceof Error ? err.message : "Unexpected server error.",
        });
      }
    })
    .finally(() => {
      clearInterval(keepAlive);
      if (!res.writableEnded) res.end();
    });
});

async function processImport(req: UploadedRequest, res: Response): Promise<void> {
  if (!req.file) {
    sseWrite(res, "error", { message: "CSV file is required." });
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
    skipped.push({ source_row_index: err.row, reason: `CSV parse warning: ${err.message}` });
  });

  rawRows.forEach((row, index) => {
    if (parseErrorIndices.has(index)) return; // already skipped via parse error

    if (hasEmailOrMobile(row)) {
      candidateRows.push({ row, index });
    } else {
      skipped.push({
        source_row_index: index,
        reason: "Skipped because the row contains neither email nor mobile number.",
      });
    }
  });

  const batches = chunkRows(candidateRows, config.batchSize);
  const totalBatches = batches.length;

  // Notify client of the plan so it can render a progress bar
  sseWrite(res, "init", { totalBatches, totalRows: rawRows.length });

  if (candidateRows.length === 0) {
    sseWrite(res, "done", {
      imported: [],
      skipped,
      totals: { imported: 0, skipped: skipped.length, processed: rawRows.length, batches: 0 },
    });
    return;
  }

  // Validate AI provider is available before starting
  let extractor: AiExtractor;
  try {
    extractor = createAiExtractor();
  } catch (error) {
    sseWrite(res, "error", {
      message: error instanceof Error ? error.message : "AI provider is not configured.",
    });
    return;
  }

  const imported: Array<LeadRecord & { source_row_index: number }> = [];

  const batchTasks = batches.map((batch, batchIndex) => async () => {
    sseWrite(res, "batch_start", { batchNumber: batchIndex + 1, totalBatches });

    const rowsForAi = batch.map(({ row }) => row);
    const records = await extractor.extractBatch({
      rows: rowsForAi,
      batchNumber: batchIndex + 1,
    });

    const batchImported: Array<LeadRecord & { source_row_index: number }> = [];
    const batchSkipped: Array<{ source_row_index: number; reason: string }> = [];

    batch.forEach(({ row, index }, position) => {
      const record = records[position];
      if (!record) {
        const entry = { source_row_index: index, reason: "AI did not return a record for this row." };
        batchSkipped.push(entry);
        skipped.push(entry);
        return;
      }
      try {
        const validated = leadRecordSchema.parse(record);
        const merged = mergeContactFields(validated, row);
        const normalized = normalizeLeadRecord(merged);
        const entry = { ...normalized, source_row_index: index };
        imported.push(entry);
        batchImported.push(entry);
      } catch (error) {
        const reason =
          error instanceof ZodError
            ? `Validation failed: ${error.errors.map((e) => e.message).join("; ")}`
            : "Unknown validation error.";
        const entry = { source_row_index: index, reason };
        batchSkipped.push(entry);
        skipped.push(entry);
      }
    });

    // Stream partial results to the client as they arrive
    sseWrite(res, "batch_done", {
      batchNumber: batchIndex + 1,
      totalBatches,
      imported: batchImported,
      skipped: batchSkipped,
    });
  });

  const batchResults = await runWithConcurrency(batchTasks, 3);

  // Process rejected batches — the task functions handle fulfilled ones internally
  batches.forEach((batch, batchIndex) => {
    const result = batchResults[batchIndex];
    if (result.status === "rejected") {
      const batchSkipped: Array<{ source_row_index: number; reason: string }> = [];
      batch.forEach(({ index }) => {
        const entry = {
          source_row_index: index,
          reason: `AI batch ${batchIndex + 1} failed: ${(result.reason as Error).message}`,
        };
        batchSkipped.push(entry);
        skipped.push(entry);
      });
      sseWrite(res, "batch_done", {
        batchNumber: batchIndex + 1,
        totalBatches,
        imported: [],
        skipped: batchSkipped,
      });
    }
  });

  // Sort final imported list back to original CSV row order
  imported.sort((a, b) => a.source_row_index - b.source_row_index);

  sseWrite(res, "done", {
    imported,
    skipped,
    totals: {
      imported: imported.length,
      skipped: skipped.length,
      processed: rawRows.length,
      batches: totalBatches,
    },
  });
}
