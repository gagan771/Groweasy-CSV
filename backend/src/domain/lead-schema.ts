import { z } from "zod";
import {
  looksLikeEmail,
  looksLikeMobile,
  isLikelyLeadOwnerHeader,
  isLikelyLeadContactHeader,
  normalizeHeaderForMatch,
} from "./csv";

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
    .refine(
      (value) =>
        value.trim() === "" || !Number.isNaN(new Date(value).getTime()),
      {
        message: "created_at must be empty or a valid date string parseable by new Date()",
      },
    ),
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
  const entries = Object.entries(rawRow).map(([header, value]) => ({
    header,
    normalizedHeader: normalizeHeaderForMatch(header),
    value: String(value ?? "").trim(),
  }));

  const ownerEntries = entries.filter((entry) => isLikelyLeadOwnerHeader(entry.header));
  const nonOwnerEntries = entries.filter((entry) => !isLikelyLeadOwnerHeader(entry.header));
  const leadContactHeaderEntries = nonOwnerEntries.filter((entry) =>
    isLikelyLeadContactHeader(entry.header),
  );
  const contactCandidates =
    leadContactHeaderEntries.length > 0 ? leadContactHeaderEntries : nonOwnerEntries;

  const allEmails = contactCandidates
    .map((entry) => entry.value)
    .filter((value) => looksLikeEmail(value));
  const allPhones = contactCandidates
    .map((entry) => entry.value)
    .filter((value) => looksLikeMobile(value));

  const ownerValues = ownerEntries
    .map((entry) => entry.value)
    .filter((value) => value.length > 0);

  const candidateEmailSet = new Set(allEmails.map((value) => value.toLowerCase()));
  const normalizePhone = (value: string) => value.replace(/[^\d]/g, "");
  const candidatePhoneSet = new Set(allPhones.map((value) => normalizePhone(value)));

  let email = (record.email ?? "").trim();
  if (email && !candidateEmailSet.has(email.toLowerCase())) {
    email = "";
  }
  if (!email) email = allEmails[0] || "";

  let mobile = (record.mobile_without_country_code ?? "").trim();
  if (mobile && !candidatePhoneSet.has(normalizePhone(mobile))) {
    mobile = "";
  }
  if (!mobile) mobile = allPhones[0] || "";

  const pickFromHeaderHints = (
    hints: string[],
    fallbackEntries: typeof nonOwnerEntries = nonOwnerEntries,
  ): string => {
    const found = fallbackEntries.find(
      (entry) =>
        entry.value.length > 0 &&
        hints.some((hint) => entry.normalizedHeader.includes(hint)),
    );
    return found?.value ?? "";
  };

  const company = (record.company ?? "").trim() || pickFromHeaderHints(["company", "business"]);
  const city = (record.city ?? "").trim() || pickFromHeaderHints(["city", "location", "town"]);
  const state = (record.state ?? "").trim() || pickFromHeaderHints(["state", "region", "province"]);
  const country =
    (record.country ?? "").trim() || pickFromHeaderHints(["country", "nation"]);
  const leadOwner = (record.lead_owner ?? "").trim() || ownerValues[0] || pickFromHeaderHints(
    ["assigned to", "lead owner", "owner", "sales rep", "salesperson", "sales person"],
    entries,
  );

  const extras: string[] = [];

  if (record.crm_note) extras.push(record.crm_note);

  // Extra emails beyond the first
  for (let i = allEmails[0] === email ? 1 : 0; i < allEmails.length; i++) {
    if (allEmails[i].toLowerCase() !== email.toLowerCase()) {
      extras.push(`extra email: ${allEmails[i]}`);
    }
  }

  // Extra phones beyond the first
  for (let i = allPhones[0] === mobile ? 1 : 0; i < allPhones.length; i++) {
    if (normalizePhone(allPhones[i]) !== normalizePhone(mobile)) {
      extras.push(`extra phone: ${allPhones[i]}`);
    }
  }

  return {
    ...record,
    email,
    mobile_without_country_code: mobile,
    company,
    city,
    state,
    country,
    lead_owner: leadOwner,
    crm_note: extras.filter(Boolean).join("; "),
  };
}

export const extractedBatchSchema = z.object({
  records: z.array(leadRecordSchema),
});

export type ExtractedBatch = z.infer<typeof extractedBatchSchema>;
