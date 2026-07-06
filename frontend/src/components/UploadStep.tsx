"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { parseCsvText } from "@/lib/csv";

interface UploadStepProps {
  onFileParsed: (rows: Record<string, string>[], file: File) => void;
  onParseError?: (message: string) => void;
}

export default function UploadStep({ onFileParsed, onParseError }: UploadStepProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        const { rows, errors } = parseCsvText(text);

        // Only block on fatal errors (e.g. malformed quoting).
        // Non-fatal warnings like TooFewFields / TooManyFields are acceptable.
        const fatalErrors = errors.filter(
          (e) => e.type === "Quotes" || e.type === "MissingQuotes",
        );
        if (fatalErrors.length > 0) {
          onParseError?.(`CSV parsing error: ${fatalErrors[0].message}`);
          return;
        }

        if (rows.length === 0) {
          onParseError?.("The CSV file appears to be empty or has no valid data rows.");
          return;
        }

        onFileParsed(rows, file);
      };

      reader.onerror = () => {
        onParseError?.("Unable to read the selected file.");
      };

      reader.readAsText(file);
    },
    [onFileParsed, onParseError],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 transition-colors
        ${isDragActive
          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
          : "border-gray-300 hover:border-blue-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-gray-800/40"
        }`}
    >
      <input {...getInputProps()} />

      {/* Upload icon */}
      <div className={`mb-4 ${isDragActive ? "text-blue-500 dark:text-blue-400" : "text-gray-300 dark:text-gray-600"}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="52"
          height="52"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>

      {isDragActive ? (
        <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
          Drop your CSV file here…
        </p>
      ) : (
        <>
          <p className="mb-1 text-lg font-medium text-gray-700 dark:text-gray-300">
            Drag &amp; drop a CSV file here
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            or <span className="text-blue-600 underline dark:text-blue-400">click to browse</span>
          </p>
          <p className="mt-3 text-xs text-gray-300 dark:text-gray-600">
            .csv files only · up to 10 MB
          </p>
        </>
      )}
    </div>
  );
}
