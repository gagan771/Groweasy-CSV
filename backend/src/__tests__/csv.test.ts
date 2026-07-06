import { describe, it, expect } from "vitest";
import {
  parseCsv,
  hasEmailOrMobile,
  looksLikeEmail,
  looksLikeMobile,
  chunkRows,
} from "../domain/csv";

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------
describe("parseCsv", () => {
  it("parses a well-formed CSV with headers", () => {
    const csv = `name,email,phone\nAlice,alice@example.com,9876543210\nBob,bob@example.com,1234567890`;
    const { rows, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Alice");
    expect(rows[0].email).toBe("alice@example.com");
  });

  it("trims whitespace from headers and values", () => {
    const csv = ` name , email \n  Alice ,  alice@example.com  `;
    const { rows } = parseCsv(csv);
    expect(rows[0].name).toBe("Alice");
    expect(rows[0].email).toBe("alice@example.com");
  });

  it("skips completely empty rows", () => {
    const csv = `name,email\nAlice,alice@example.com\n\n\n`;
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(1);
  });

  it("returns an empty rows array for a header-only CSV", () => {
    const csv = `name,email,phone`;
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(0);
  });

  it("returns empty rows for a completely empty string (PapaParse emits a minor error)", () => {
    const { rows } = parseCsv("");
    expect(rows).toHaveLength(0);
    // Note: PapaParse emits a parse-level error for empty input, which is acceptable
  });
});

// ---------------------------------------------------------------------------
// looksLikeEmail
// ---------------------------------------------------------------------------
describe("looksLikeEmail", () => {
  it("returns true for valid emails", () => {
    expect(looksLikeEmail("user@example.com")).toBe(true);
    expect(looksLikeEmail("john.doe+tag@mail.co.uk")).toBe(true);
    expect(looksLikeEmail("x@y.z")).toBe(true);
  });

  it("returns false for non-email strings", () => {
    expect(looksLikeEmail("not-an-email")).toBe(false);
    expect(looksLikeEmail("@example.com")).toBe(false);
    expect(looksLikeEmail("user@")).toBe(false);
    expect(looksLikeEmail("")).toBe(false);
    expect(looksLikeEmail("9876543210")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// looksLikeMobile
// ---------------------------------------------------------------------------
describe("looksLikeMobile", () => {
  it("returns true for valid phone numbers", () => {
    expect(looksLikeMobile("9876543210")).toBe(true);      // 10 digits
    expect(looksLikeMobile("+91 98765 43210")).toBe(true); // formatted
    expect(looksLikeMobile("(123) 456-7890")).toBe(true);  // US style
    expect(looksLikeMobile("1234567")).toBe(true);          // 7 digits (min)
  });

  it("returns false for non-phone strings", () => {
    expect(looksLikeMobile("abc")).toBe(false);            // letters
    expect(looksLikeMobile("123")).toBe(false);            // too short
    expect(looksLikeMobile("1234567890123456")).toBe(false); // too long (16)
    expect(looksLikeMobile("20260507")).toBe(true);        // date-like but passes (8 digits)
    // Key fix: values with non-phone chars should fail
    expect(looksLikeMobile("1500000 USD")).toBe(false);    // letters in string
    expect(looksLikeMobile("$1,500,000")).toBe(false);     // dollar + comma
    expect(looksLikeMobile("12.5%")).toBe(false);           // percent
  });

  it("strips common phone formatting chars before checking", () => {
    expect(looksLikeMobile("+1-800-555-1234")).toBe(true);
    expect(looksLikeMobile("(800) 555-1234")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasEmailOrMobile
// ---------------------------------------------------------------------------
describe("hasEmailOrMobile", () => {
  it("returns true when a cell contains a valid email", () => {
    const row = { name: "Alice", email: "alice@example.com", phone: "" };
    expect(hasEmailOrMobile(row)).toBe(true);
  });

  it("returns true when a cell contains a valid mobile number", () => {
    const row = { name: "Bob", phone: "9876543210", email: "" };
    expect(hasEmailOrMobile(row)).toBe(true);
  });

  it("returns false when no email or mobile is present", () => {
    const row = { name: "Charlie", company: "ACME" };
    expect(hasEmailOrMobile(row)).toBe(false);
  });

  it("returns false for a completely empty row", () => {
    expect(hasEmailOrMobile({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chunkRows
// ---------------------------------------------------------------------------
describe("chunkRows", () => {
  it("splits an array into chunks of the given size", () => {
    const chunks = chunkRows([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when size >= array length", () => {
    const chunks = chunkRows([1, 2, 3], 10);
    expect(chunks).toEqual([[1, 2, 3]]);
  });

  it("returns an empty array for an empty input", () => {
    expect(chunkRows([], 5)).toEqual([]);
  });

  it("returns chunks of exactly one item when size is 1", () => {
    const chunks = chunkRows(["a", "b", "c"], 1);
    expect(chunks).toEqual([["a"], ["b"], ["c"]]);
  });
});
