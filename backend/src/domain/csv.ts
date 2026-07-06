import Papa, { type ParseError } from "papaparse";

export type CsvRow = Record<string, string>;

export interface ParseResult {
  rows: CsvRow[];
  errors: { row: number; message: string }[];
}

export function parseCsv(text: string): ParseResult {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
  });

  const errors: { row: number; message: string }[] = result.errors.map(
    (error: ParseError) => ({
      row: (error as { row?: number }).row ?? -1,
      message: error.message,
    }),
  );

  const rows = result.data.filter((row: CsvRow) =>
    Object.values(row).some((value) => String(value ?? "").trim().length > 0),
  );

  return { rows, errors };
}

export function hasEmailOrMobile(row: CsvRow): boolean {
  const values = Object.values(row).map((value) => String(value ?? "").trim());
  return values.some((value) => looksLikeEmail(value) || looksLikeMobile(value));
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function looksLikeMobile(value: string): boolean {
  // Strip common phone formatting characters first
  const cleaned = value.replace(/[\s\-().+]/g, "");
  // Must consist only of digits after stripping (no letters, no other symbols)
  if (!/^\d+$/.test(cleaned)) return false;
  // Digit count must be in the valid international phone range
  return cleaned.length >= 7 && cleaned.length <= 15;
}

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}
