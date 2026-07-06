/**
 * Downloads data as a CSV file in the browser.
 * Handles proper RFC 4180 escaping (quotes, commas, newlines).
 */
export function downloadCsv(filename: string, data: Record<string, unknown>[]): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);

  const escape = (value: unknown): string => {
    const str = String(value ?? "");
    // Wrap in quotes if the value contains comma, double-quote, newline, or carriage return
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [
    headers.join(","),
    ...data.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const csvContent = rows.join("\r\n"); // CRLF per RFC 4180
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // BOM for Excel compatibility
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Formats a Date into a filename-safe string like 2026-07-07_02-55 */
export function filenameDateStamp(): string {
  return new Date()
    .toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .slice(0, 16);
}
