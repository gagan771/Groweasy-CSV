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
  const entries = Object.entries(row).map(([header, value]) => ({
    header,
    value: String(value ?? "").trim(),
  }));
  const nonOwnerEntries = entries.filter((entry) => !isLikelyLeadOwnerHeader(entry.header));

  if (nonOwnerEntries.length === 0) return false;

  const leadContactHeaderEntries = nonOwnerEntries.filter((entry) =>
    isLikelyLeadContactHeader(entry.header),
  );
  const candidates =
    leadContactHeaderEntries.length > 0 ? leadContactHeaderEntries : nonOwnerEntries;

  return candidates.some(
    (entry) => looksLikeEmail(entry.value) || looksLikeMobile(entry.value),
  );
}

export function looksLikeEmail(value: string): boolean {
  return value.split(/[;,]+/).some((segment) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(segment.trim()));
}

export function looksLikeMobile(value: string): boolean {
  return value.split(/[;,]+/).some((segment) => {
    const cleaned = segment.replace(/[\s\-().+]/g, "");
    if (!/^\d+$/.test(cleaned)) return false;
    return cleaned.length >= 7 && cleaned.length <= 15;
  });
}

export function normalizeHeaderForMatch(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isLikelyLeadOwnerHeader(header: string): boolean {
  const normalized = normalizeHeaderForMatch(header);
  const ownerHints = [
    "assigned to",
    "lead owner",
    "owner",
    "sales rep",
    "salesperson",
    "sales person",
    "relationship manager",
    "rm",
    "agent",
    "advisor",
    "executive",
  ];
  return ownerHints.some((hint) => normalized.includes(hint));
}

export function isLikelyLeadContactHeader(header: string): boolean {
  const normalized = normalizeHeaderForMatch(header);
  const contactHints = [
    "email",
    "e-mail",
    "mail",
    "phone",
    "mobile",
    "contact",
    "whatsapp",
    "cell",
    "tel",
    "alternate",
    "secondary",
    "alt number",
    "alt phone",
  ];
  return contactHints.some((hint) => normalized.includes(hint));
}

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}
