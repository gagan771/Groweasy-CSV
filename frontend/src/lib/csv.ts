import Papa, { type ParseError } from "papaparse";

export type CsvRow = Record<string, string>;

export interface CsvParseError {
  type: string;
  code: string;
  message: string;
  row?: number;
}

export function parseCsvText(text: string): { rows: CsvRow[]; errors: CsvParseError[] } {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
  });

  const errors: CsvParseError[] = result.errors.map((error: ParseError) => ({
    type: error.type,
    code: error.code,
    message: error.message,
    row: (error as { row?: number }).row,
  }));

  const rows = result.data.filter((row: CsvRow) =>
    Object.values(row).some((value) => String(value ?? "").trim().length > 0),
  );

  return { rows, errors };
}
