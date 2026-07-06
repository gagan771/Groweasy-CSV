import type { ImportResponse, ImportedRecord, SkippedRecord } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

// ---------------------------------------------------------------------------
// SSE event types from the backend
// ---------------------------------------------------------------------------
export interface InitEvent {
  totalBatches: number;
  totalRows: number;
}

export interface BatchStartEvent {
  batchNumber: number;
  totalBatches: number;
}

export interface BatchDoneEvent {
  batchNumber: number;
  totalBatches: number;
  imported: ImportedRecord[];
  skipped: SkippedRecord[];
}

export interface DoneEvent extends ImportResponse {}

export interface ErrorEvent {
  message: string;
}

export type StreamEventPayload =
  | { type: "init"; data: InitEvent }
  | { type: "batch_start"; data: BatchStartEvent }
  | { type: "batch_done"; data: BatchDoneEvent }
  | { type: "done"; data: DoneEvent }
  | { type: "error"; data: ErrorEvent };

export interface StreamCallbacks {
  onStreamOpen?: () => void;
  onInit?: (data: InitEvent) => void;
  onBatchStart?: (data: BatchStartEvent) => void;
  onBatchDone?: (data: BatchDoneEvent) => void;
  onDone?: (data: DoneEvent) => void;
  onError?: (message: string) => void;
}

/**
 * Sends a CSV file to the backend SSE streaming endpoint and fires callbacks
 * as each SSE event arrives. Returns a Promise that resolves when the stream
 * is complete or rejects on a network-level error.
 */
export async function streamImport(
  file: File,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/imports/stream`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Server error (${res.status})`);
  }

  callbacks.onStreamOpen?.();

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;

    // SSE events are separated by double newlines
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      if (!block.trim() || block.startsWith(":")) continue; // skip keep-alive pings

      const eventMatch = block.match(/^event:\s*(.+)$/m);
      const dataMatch = block.match(/^data:\s*([\s\S]+)$/m);

      if (!eventMatch || !dataMatch) continue;

      const eventType = eventMatch[1].trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(dataMatch[1].trim());
      } catch {
        continue; // skip malformed data
      }

      switch (eventType) {
        case "init":
          callbacks.onInit?.(parsed as InitEvent);
          break;
        case "batch_start":
          callbacks.onBatchStart?.(parsed as BatchStartEvent);
          break;
        case "batch_done":
          callbacks.onBatchDone?.(parsed as BatchDoneEvent);
          break;
        case "done":
          callbacks.onDone?.(parsed as DoneEvent);
          break;
        case "error":
          callbacks.onError?.((parsed as ErrorEvent).message);
          break;
      }
    }
  }
}
