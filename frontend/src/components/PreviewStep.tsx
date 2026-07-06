"use client";

import { useMemo, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

interface PreviewStepProps {
  rows: Record<string, string>[];
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}

const ROW_HEIGHT = 36; // px — fixed height enables virtualization
const TABLE_HEIGHT = 420; // px — visible viewport

export default function PreviewStep({ rows, onConfirm, onBack, loading }: PreviewStepProps) {
  const columns = useMemo<ColumnDef<Record<string, string>>[]>(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({
      id: key,
      header: key,
      accessorFn: (row) => row[key],
      size: 160,
    }));
  }, [rows]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  // Virtualizer for the tbody rows
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10, // render 10 extra rows off-screen for smooth scrolling
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalVirtualSize = virtualizer.getTotalSize();

  return (
    <div className="flex flex-col gap-4">
      {/* Info bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {rows.length.toLocaleString()} row{rows.length !== 1 ? "s" : ""} detected
          {rows.length > 100 && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              Virtualized scroll
            </span>
          )}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {columns.length} column{columns.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table with both horizontal and vertical virtualized scroll */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Horizontal scroll container */}
        <div className="overflow-x-auto">
          {/* Sticky header */}
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="whitespace-nowrap border-b border-gray-200 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          </table>

          {/* Virtualized body — scrollable vertically */}
          <div
            ref={parentRef}
            style={{ height: `${Math.min(TABLE_HEIGHT, tableRows.length * ROW_HEIGHT + 2)}px` }}
            className="overflow-y-auto"
          >
            <div style={{ height: `${totalVirtualSize}px`, position: "relative" }}>
              <table className="min-w-full text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  {table.getAllLeafColumns().map((col) => (
                    <col key={col.id} style={{ width: col.getSize() }} />
                  ))}
                </colgroup>
                <tbody>
                  {virtualItems.map((virtualRow) => {
                    const row = tableRows[virtualRow.index];
                    return (
                      <tr
                        key={row.id}
                        style={{
                          position: "absolute",
                          top: `${virtualRow.start}px`,
                          left: 0,
                          width: "100%",
                          height: `${ROW_HEIGHT}px`,
                        }}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="truncate px-4 py-2 text-gray-700 dark:text-gray-300"
                            title={String(cell.getValue() ?? "")}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-6 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || rows.length === 0}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Importing…" : `Confirm Import (${rows.length.toLocaleString()} rows)`}
        </button>
      </div>
    </div>
  );
}
