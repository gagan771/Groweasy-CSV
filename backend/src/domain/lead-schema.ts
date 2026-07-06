import { z } from "zod";
import { looksLikeEmail, looksLikeMobile } from "./csv";

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

export const leadRecordSchema = z.object({
  created_at: z
    .string()
    .min(1, { message: "created_at is required" })
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "created_at must be a valid date string parseable by new Date()",
    }),
  name: z.string().nullish().default(""),
  email: z.string().nullish().default(""),
  country_code: z.string().nullish().default(""),
  mobile_without_country_code: z.string().nullish().default(""),
  company: z.string().nullish().default(""),
  city: z.string().nullish().default(""),
  state: z.string().nullish().default(""),
  country: z.string().nullish().default(""),
  lead_owner: z.string().nullish().default(""),
  crm_status: z.enum(crmStatusValues).default("DID_NOT_CONNECT"),
  crm_note: z.string().nullish().default(""),
  data_source: z.union([z.enum(dataSourceValues), z.literal("")]).default(""),
  possession_time: z.string().nullish().default(""),
  description: z.string().nullish().default(""),
});

export type LeadRecord = z.infer<typeof leadRecordSchema>;

function trimValues(input: LeadRecord): LeadRecord {
  return {
    ...input,
    created_at: input.created_at.trim(),
    name: (input.name ?? "").trim(),
    email: (input.email ?? "").trim(),
    country_code: (input.country_code ?? "").trim(),
    mobile_without_country_code: (input.mobile_without_country_code ?? "").trim(),
    company: (input.company ?? "").trim(),
    city: (input.city ?? "").trim(),
    state: (input.state ?? "").trim(),
    country: (input.country ?? "").trim(),
    lead_owner: (input.lead_owner ?? "").trim(),
    crm_note: (input.crm_note ?? "").trim(),
    data_source: input.data_source,
    possession_time: (input.possession_time ?? "").trim(),
    description: (input.description ?? "").trim(),
  };
}

export function normalizeLeadRecord(input: LeadRecord): LeadRecord {
  return trimValues(input);
}

/**
 * Post-processes AI output to enforce "first email → email, first phone → mobile,
 * remaining → crm_note" rule by scanning the original CSV row.
 */
export function mergeContactFields(
  record: LeadRecord,
  rawRow: Record<string, string>,
): LeadRecord {
  const values = Object.values(rawRow).map((v) => String(v ?? "").trim());
  const allEmails = values.filter((v) => looksLikeEmail(v));
  const allPhones = values.filter((v) => looksLikeMobile(v));

  let email = record.email || allEmails[0] || "";
  let mobile = record.mobile_without_country_code || allPhones[0] || "";
  const extras: string[] = [];

  if (record.crm_note) extras.push(record.crm_note);

  // Extra emails beyond the first
  for (let i = allEmails[0] === email ? 1 : 0; i < allEmails.length; i++) {
    if (allEmails[i] !== email) extras.push(`extra email: ${allEmails[i]}`);
  }

  // Extra phones beyond the first
  for (let i = allPhones[0] === mobile ? 1 : 0; i < allPhones.length; i++) {
    if (allPhones[i] !== mobile) extras.push(`extra phone: ${allPhones[i]}`);
  }

  return {
    ...record,
    email,
    mobile_without_country_code: mobile,
    crm_note: extras.filter(Boolean).join("; "),
  };
}

export const extractedBatchSchema = z.object({
  records: z.array(leadRecordSchema),
});

export type ExtractedBatch = z.infer<typeof extractedBatchSchema>;
