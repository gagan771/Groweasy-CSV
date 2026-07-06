"use client";

import { useState, useCallback, useRef } from "react";
import UploadStep from "@/components/UploadStep";
import PreviewStep from "@/components/PreviewStep";
import ProgressStep from "@/components/ProgressStep";
import ResultsStep from "@/components/ResultsStep";
import { streamImport } from "@/lib/stream";
import type { ImportPhase, ImportResponse, ImportedRecord, SkippedRecord } from "@/types";

type Step = "upload" | "preview" | "importing" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const [importPhase, setImportPhase] = useState<ImportPhase>("connecting");
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [liveImported, setLiveImported] = useState<ImportedRecord[]>([]);
  const [liveSkipped, setLiveSkipped] = useState<SkippedRecord[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const handleFileParsed = useCallback(
    (rows: Record<string, string>[], file: File) => {
      setPreviewRows(rows);
      setCsvFile(file);
      setError(null);
      setStep("preview");
    },
    [],
  );

  const handleParseError = useCallback((message: string) => {
    setError(message);
    setStep("upload");
  }, []);

  const resetImportState = useCallback(() => {
    setImportPhase("connecting");
    setTotalBatches(0);
    setTotalRows(0);
    setCompletedBatches(0);
    setCurrentBatch(0);
    setLiveImported([]);
    setLiveSkipped([]);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!csvFile) return;

    resetImportState();
    setStep("importing");
    setImportPhase("connecting");
    setError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await streamImport(
        csvFile,
        {
          onStreamOpen: () => setImportPhase("analysing"),
          onInit: (data) => {
            setTotalBatches(data.totalBatches);
            setTotalRows(data.totalRows);
            if (data.totalBatches === 0) {
              setImportPhase("finalizing");
            } else {
              setImportPhase("llm_request");
              setCurrentBatch(0);
            }
          },
          onBatchStart: (data) => {
            setImportPhase("llm_request");
            setCurrentBatch(data.batchNumber);
          },
          onBatchDone: (data) => {
            setImportPhase("streaming");
            setCompletedBatches(data.batchNumber);
            setCurrentBatch(data.batchNumber);
            setLiveImported((prev) => [...prev, ...data.imported]);
            setLiveSkipped((prev) => [...prev, ...data.skipped]);
            if (data.batchNumber >= data.totalBatches) {
              setImportPhase("finalizing");
            }
          },
          onDone: (data) => {
            setResult(data);
            setStep("results");
          },
          onError: (message) => {
            setError(message);
            setStep("preview");
          },
        },
        abort.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    } finally {
      abortRef.current = null;
    }
  }, [csvFile, resetImportState]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    resetImportState();
    setStep("preview");
  }, [resetImportState]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep("upload");
    setPreviewRows([]);
    setCsvFile(null);
    setError(null);
    setResult(null);
    resetImportState();
  }, [resetImportState]);

  const STEPS = ["upload", "preview", "importing", "results"] as const;
  const STEP_LABELS: Record<(typeof STEPS)[number], string> = {
    upload: "Upload",
    preview: "Preview",
    importing: "Extract",
    results: "Results",
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-53px)] max-w-5xl flex-col px-4 py-8">
      {/* Step breadcrumb */}
      <nav aria-label="Progress" className="mb-8 flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-gray-300 dark:text-gray-600">›</span>}
            <span
              className={
                step === s
                  ? "font-semibold text-blue-600 dark:text-blue-400"
                  : stepIndex > i
                    ? "text-gray-500 dark:text-gray-400"
                    : "text-gray-300 dark:text-gray-600"
              }
            >
              {STEP_LABELS[s]}
            </span>
          </span>
        ))}
      </nav>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* Step content */}
      {step === "upload" && (
        <UploadStep onFileParsed={handleFileParsed} onParseError={handleParseError} />
      )}

      {step === "preview" && (
        <PreviewStep rows={previewRows} onConfirm={handleConfirm} onBack={handleReset} loading={false} />
      )}

      {step === "importing" && (
        <ProgressStep
          phase={importPhase}
          totalBatches={totalBatches}
          totalRows={totalRows}
          completedBatches={completedBatches}
          currentBatch={currentBatch}
          importedCount={liveImported.length}
          skippedCount={liveSkipped.length}
          liveImported={liveImported}
          liveSkipped={liveSkipped}
          onCancel={handleCancel}
        />
      )}

      {step === "results" && result && (
        <ResultsStep result={result} onReset={handleReset} />
      )}
    </div>
  );
}
