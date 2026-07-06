export const crmStatusValues = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export const dataSourceValues = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export type CrmStatus = (typeof crmStatusValues)[number];
export type DataSource = (typeof dataSourceValues)[number] | "";

export interface LeadRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CrmStatus;
  crm_note: string;
  data_source: DataSource;
  possession_time: string;
  description: string;
}

export interface ImportedRecord extends LeadRecord {
  source_row_index: number;
}

export interface SkippedRecord {
  source_row_index: number;
  reason: string;
}

export interface ImportResponse {
  imported: ImportedRecord[];
  skipped: SkippedRecord[];
  totals: {
    imported: number;
    skipped: number;
    processed: number;
    batches: number;
  };
}

export type PreviewRow = Record<string, string>;

/** Live import phase shown during SSE extraction. */
export type ImportPhase =
  | "connecting"
  | "analysing"
  | "llm_request"
  | "streaming"
  | "finalizing";
