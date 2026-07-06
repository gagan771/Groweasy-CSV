"use client";

import { useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import type { ImportedRecord, SkippedRecord, ImportResponse } from "@/types";
import { downloadCsv, filenameDateStamp } from "@/lib/export";

interface ResultsStepProps {
  result: ImportResponse;
  onReset: () => void;
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function StatCard({
  value,
  label,
  colorClass,
}: {
  value: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className={`rounded-xl border p-4 text-center ${colorClass}`}>
      <div className="text-3xl font-bold tabular-nums">{value.toLocaleString()}</div>
      <div className="mt-1 text-sm font-medium opacity-80">{label}</div>
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
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ImportedTable({ records }: { records: ImportedRecord[] }) {
  const columns = useMemo<ColumnDef<ImportedRecord>[]>(
    () => [
      { id: "name", header: "Name", accessorFn: (r) => r.name },
      { id: "email", header: "Email", accessorFn: (r) => r.email },
      {
        id: "mobile",
        header: "Mobile",
        accessorFn: (r) =>
          [r.country_code, r.mobile_without_country_code].filter(Boolean).join(" "),
      },
      { id: "company", header: "Company", accessorFn: (r) => r.company },
      { id: "city", header: "City", accessorFn: (r) => r.city },
      { id: "state", header: "State", accessorFn: (r) => r.state },
      { id: "country", header: "Country", accessorFn: (r) => r.country },
      { id: "lead_owner", header: "Lead Owner", accessorFn: (r) => r.lead_owner },
      {
        id: "crm_status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.crm_status} />,
        accessorFn: (r) => r.crm_status,
      },
      { id: "data_source", header: "Source", accessorFn: (r) => r.data_source },
      { id: "possession_time", header: "Possession", accessorFn: (r) => r.possession_time },
      { id: "description", header: "Description", accessorFn: (r) => r.description },
      { id: "crm_note", header: "Notes", accessorFn: (r) => r.crm_note },
      { id: "created_at", header: "Created", accessorFn: (r) => r.created_at },
    ],
    [],
  );

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Imported Records ({records.length.toLocaleString()})
        </h3>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/60"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="max-w-[180px] truncate whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300"
                    title={String(cell.getValue() ?? "")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkippedTable({ records }: { records: SkippedRecord[] }) {
  if (records.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
          Skipped Rows ({records.length.toLocaleString()})
        </h3>
      </div>
      <div className="overflow-x-auto rounded-lg border border-red-200 dark:border-red-900/40">
        <table className="min-w-full divide-y divide-red-100 text-sm dark:divide-red-900/30">
          <thead className="bg-red-50 dark:bg-red-950/30">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                Row #
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
            {records.map((r, i) => (
              <tr
                key={i}
                className="bg-white hover:bg-red-50 dark:bg-gray-900 dark:hover:bg-red-950/20"
              >
                <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                  #{r.source_row_index + 1}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ResultsStep({ result, onReset }: ResultsStepProps) {
  const handleExportAll = useCallback(() => {
    if (result.imported.length > 0) {
      downloadCsv(
        `groweasy_imported_${filenameDateStamp()}.csv`,
        result.imported.map((r) => ({
          created_at: r.created_at,
          name: r.name,
          email: r.email,
          country_code: r.country_code,
          mobile_without_country_code: r.mobile_without_country_code,
          company: r.company,
          city: r.city,
          state: r.state,
          country: r.country,
          lead_owner: r.lead_owner,
          crm_status: r.crm_status,
          crm_note: r.crm_note,
          data_source: r.data_source,
          possession_time: r.possession_time,
          description: r.description,
        })),
      );
    }
  }, [result.imported]);
  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          value={result.totals.imported}
          label="Imported"
          colorClass="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
        />
        <StatCard
          value={result.totals.skipped}
          label="Skipped"
          colorClass="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
        />
        <StatCard
          value={result.totals.processed}
          label="Processed"
          colorClass="border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300"
        />
        <StatCard
          value={result.totals.batches}
          label="AI Batches"
          colorClass="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
        />
      </div>

      {/* Imported table or empty state */}
      {result.imported.length > 0 ? (
        <ImportedTable records={result.imported} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 py-12 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
          No records were successfully imported.
        </div>
      )}

      {/* Skipped table */}
      <SkippedTable records={result.skipped} />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {result.imported.length > 0 && (
          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <DownloadIcon />
            Export All Imported
          </button>
        )}
        <button
          onClick={onReset}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Import Another File
        </button>
      </div>
    </div>
  );
}
