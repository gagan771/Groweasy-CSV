import { describe, it, expect } from "vitest";
import {
  leadRecordSchema,
  normalizeLeadRecord,
  mergeContactFields,
  crmStatusValues,
  dataSourceValues,
} from "../domain/lead-schema";

// ---------------------------------------------------------------------------
// leadRecordSchema
// ---------------------------------------------------------------------------
describe("leadRecordSchema", () => {
  const validRecord = {
    created_at: "2026-05-13T14:20:48.000Z",
    name: "Alice Smith",
    email: "alice@example.com",
    country_code: "+91",
    mobile_without_country_code: "9876543210",
    company: "ACME",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    lead_owner: "owner@example.com",
    crm_status: "GOOD_LEAD_FOLLOW_UP" as const,
    crm_note: "Interested in property",
    data_source: "leads_on_demand" as const,
    possession_time: "6 months",
    description: "Referred by a colleague",
  };

  it("accepts a fully valid record", () => {
    const result = leadRecordSchema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });

  it("accepts optional/nullable string fields as null (normalizeLeadRecord does the coercion)", () => {
    const result = leadRecordSchema.safeParse({ ...validRecord, name: null, company: null });
    expect(result.success).toBe(true);
    if (result.success) {
      // The schema keeps null; normalizeLeadRecord(result.data) would convert to ""
      expect(result.data.name).toBeNull();
      expect(result.data.company).toBeNull();
    }
  });

  it("defaults crm_status to DID_NOT_CONNECT when missing", () => {
    const { crm_status: _, ...rest } = validRecord;
    const result = leadRecordSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.crm_status).toBe("DID_NOT_CONNECT");
    }
  });

  it("rejects an invalid crm_status value", () => {
    const result = leadRecordSchema.safeParse({ ...validRecord, crm_status: "UNKNOWN_STATUS" });
    expect(result.success).toBe(false);
  });

  it("defaults data_source to empty string when missing", () => {
    const { data_source: _, ...rest } = validRecord;
    const result = leadRecordSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data_source).toBe("");
    }
  });

  it("rejects an invalid data_source value", () => {
    const result = leadRecordSchema.safeParse({ ...validRecord, data_source: "bad_source" });
    expect(result.success).toBe(false);
  });

  it("allows data_source to be empty string", () => {
    const result = leadRecordSchema.safeParse({ ...validRecord, data_source: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a record missing created_at", () => {
    const { created_at: _, ...rest } = validRecord;
    const result = leadRecordSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects created_at that is not a parseable date", () => {
    const result = leadRecordSchema.safeParse({ ...validRecord, created_at: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("accepts created_at in various valid date formats", () => {
    const formats = [
      "2026-05-13T14:20:48.000Z",
      "2026-05-13 14:20:48",
      "May 13, 2026",
      "2026/05/13",
    ];
    for (const fmt of formats) {
      const result = leadRecordSchema.safeParse({ ...validRecord, created_at: fmt });
      expect(result.success, `Expected ${fmt} to be valid`).toBe(true);
    }
  });

  it("allows created_at to be empty string when source data has no date", () => {
    const result = leadRecordSchema.safeParse({ ...validRecord, created_at: "" });
    expect(result.success).toBe(true);
  });

  it("exports the correct crm_status enum values", () => {
    expect(crmStatusValues).toContain("GOOD_LEAD_FOLLOW_UP");
    expect(crmStatusValues).toContain("DID_NOT_CONNECT");
    expect(crmStatusValues).toContain("BAD_LEAD");
    expect(crmStatusValues).toContain("SALE_DONE");
  });

  it("exports the correct data_source enum values", () => {
    expect(dataSourceValues).toContain("leads_on_demand");
    expect(dataSourceValues).toContain("meridian_tower");
    expect(dataSourceValues).toContain("eden_park");
    expect(dataSourceValues).toContain("varah_swamy");
    expect(dataSourceValues).toContain("sarjapur_plots");
  });
});

// ---------------------------------------------------------------------------
// normalizeLeadRecord
// ---------------------------------------------------------------------------
describe("normalizeLeadRecord", () => {
  it("trims whitespace from all string fields", () => {
    // Parse without leading/trailing whitespace on created_at (Zod validates before trim)
    const raw = leadRecordSchema.parse({
      created_at: "2026-05-13T14:20:48.000Z",
      name: "  Alice  ",
      email: "  alice@example.com  ",
      country_code: "  +91  ",
      mobile_without_country_code: "  9876543210  ",
      company: "  ACME  ",
      city: "  Mumbai  ",
      state: "  Maharashtra  ",
      country: "  India  ",
      lead_owner: "  owner@example.com  ",
      crm_status: "GOOD_LEAD_FOLLOW_UP",
      crm_note: "  some note  ",
      data_source: "leads_on_demand",
      possession_time: "  6 months  ",
      description: "  extra info  ",
    });

    const normalized = normalizeLeadRecord(raw);
    expect(normalized.name).toBe("Alice");
    expect(normalized.email).toBe("alice@example.com");
    expect(normalized.city).toBe("Mumbai");
    expect(normalized.crm_note).toBe("some note");
    expect(normalized.possession_time).toBe("6 months");
  });

  it("preserves data_source as-is (no trimming needed for enum)", () => {
    const raw = leadRecordSchema.parse({ created_at: "2026-01-01", crm_status: "BAD_LEAD", data_source: "eden_park" });
    const normalized = normalizeLeadRecord(raw);
    expect(normalized.data_source).toBe("eden_park");
  });
});

describe("mergeContactFields", () => {
  it("maps semantic headers and keeps owner email out of lead email", () => {
    const base = leadRecordSchema.parse({
      created_at: "",
      name: "Sunita Rao",
      email: "sneha@groweasy.com",
      country_code: "",
      mobile_without_country_code: "9876543210",
      company: "",
      city: "",
      state: "",
      country: "",
      lead_owner: "",
      crm_status: "DID_NOT_CONNECT",
      crm_note: "",
      data_source: "",
      possession_time: "",
      description: "",
    });

    const merged = mergeContactFields(base, {
      Name: "Sunita Rao",
      Business: "Verma Realty",
      Location: "Gurgaon",
      Region: "Haryana",
      Nation: "India",
      Phone: "9876543210",
      "Assigned To": "sneha@groweasy.com",
    });

    expect(merged.email).toBe("");
    expect(merged.mobile_without_country_code).toBe("9876543210");
    expect(merged.lead_owner).toBe("sneha@groweasy.com");
    expect(merged.company).toBe("Verma Realty");
    expect(merged.city).toBe("Gurgaon");
    expect(merged.state).toBe("Haryana");
    expect(merged.country).toBe("India");
  });
});
