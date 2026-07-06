"use client";

import type { ImportedRecord, ImportPhase, SkippedRecord } from "@/types";

interface ProgressStepProps {
  phase: ImportPhase;
  totalBatches: number;
  totalRows: number;
  completedBatches: number;
  currentBatch: number;
  importedCount: number;
  skippedCount: number;
  liveImported: ImportedRecord[];
  liveSkipped: SkippedRecord[];
  onCancel: () => void;
}

const PIPELINE = [
  { phase: "connecting" as const, label: "Upload", hint: "Uploading CSV & opening stream" },
  { phase: "analysing" as const, label: "Analyse", hint: "Parsing CSV & filtering rows" },
  { phase: "llm_request" as const, label: "LLM request", hint: "Sending batch to AI model" },
  { phase: "streaming" as const, label: "Stream", hint: "Receiving results in real time" },
];

const PHASE_ORDER: ImportPhase[] = [
  "connecting",
  "analysing",
  "llm_request",
  "streaming",
  "finalizing",
];

function phaseIndex(phase: ImportPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

function getStatusText(
  phase: ImportPhase,
  currentBatch: number,
  totalBatches: number,
): string {
  switch (phase) {
    case "connecting":
      return "Uploading CSV & opening SSE stream…";
    case "analysing":
      return "Analysing CSV on server…";
    case "llm_request":
      if (currentBatch === 0) return "CSV analysed — preparing LLM batches…";
      return totalBatches > 0
        ? `Sending batch ${currentBatch} of ${totalBatches} to LLM…`
        : "Sending rows to LLM…";
    case "streaming":
      return totalBatches > 0
        ? `Streaming results from batch ${currentBatch}…`
        : "Streaming LLM results…";
    case "finalizing":
      return "Finalising results…";
  }
}

export default function ProgressStep({
  phase,
  totalBatches,
  totalRows,
  completedBatches,
  currentBatch,
  importedCount,
  skippedCount,
  liveImported,
  onCancel,
}: ProgressStepProps) {
  const activeIdx = phaseIndex(phase);
  const progressPercent =
    phase === "finalizing"
      ? 100
      : totalBatches > 0
        ? Math.round((completedBatches / totalBatches) * 100)
        : phase === "connecting" || phase === "analysing"
          ? 5
          : 0;

  const statusText = getStatusText(phase, currentBatch, totalBatches);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          AI Extraction in Progress
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {totalRows > 0
            ? `${totalRows} rows · ${totalBatches} batch${totalBatches !== 1 ? "es" : ""}`
            : "Preparing import…"}
        </p>
      </div>

      {/* Phase pipeline */}
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PIPELINE.map((step, i) => {
          const done = phase === "finalizing" || activeIdx > i;
          const active = phase !== "finalizing" && activeIdx === i;
          const pending = !done && !active;

          return (
            <li
              key={step.phase}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                active
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                  : done
                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                    : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-green-500 text-white"
                      : active
                        ? "bg-blue-500 text-white"
                        : "bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                  }`}
                  aria-hidden
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    active
                      ? "text-blue-700 dark:text-blue-300"
                      : done
                        ? "text-green-700 dark:text-green-400"
                        : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              <p
                className={`mt-1 text-[11px] leading-snug ${
                  pending
                    ? "text-gray-400 dark:text-gray-500"
                    : active
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {step.hint}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{statusText}</span>
          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
            {progressPercent}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>
            <span className="font-semibold text-green-600 dark:text-green-400">{importedCount}</span>{" "}
            imported so far
          </span>
          {skippedCount > 0 && (
            <span>
              <span className="font-semibold text-red-500 dark:text-red-400">{skippedCount}</span>{" "}
              skipped
            </span>
          )}
        </div>
      </div>

      {/* Live records preview */}
      {liveImported.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Live stream
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr>
                  {["Name", "Email", "Mobile", "Status"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {liveImported
                  .slice(-20)
                  .reverse()
                  .map((r, i) => (
                    <tr
                      key={i}
                      className="animate-fadeIn bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
                    >
                      <td className="max-w-[140px] truncate px-3 py-1.5 text-gray-700 dark:text-gray-300">
                        {r.name || "—"}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-1.5 text-gray-600 dark:text-gray-400">
                        {r.email || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-gray-600 dark:text-gray-400">
                        {[r.country_code, r.mobile_without_country_code].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <StatusBadge status={r.crm_status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel */}
      <div>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    GOOD_LEAD_FOLLOW_UP: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    DID_NOT_CONNECT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    BAD_LEAD: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    SALE_DONE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  const label = status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}
