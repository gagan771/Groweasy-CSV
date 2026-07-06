import { config } from "../config";
import { extractedBatchSchema, type LeadRecord, normalizeLeadRecord } from "../domain/lead-schema";
import type { CsvRow } from "../domain/csv";

export interface AiExtractor {
  extractBatch(input: {
    rows: CsvRow[];
    batchNumber: number;
  }): Promise<LeadRecord[]>;
}

export function createAiExtractor(): AiExtractor {
  if (!config.aiApiKey || !config.aiModel) {
    throw new Error(
      "AI provider is not configured. Set AI_API_KEY and AI_MODEL to enable extraction.",
    );
  }

  return {
    async extractBatch({ rows, batchNumber }) {
      const payload = await postChatCompletions(batchNumber, rows);
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("AI response did not include message content.");
      }

      const json = extractJson(content);
      let rawJson: unknown;
      try {
        rawJson = JSON.parse(json);
      } catch {
        throw new Error(
          `AI returned invalid JSON for batch ${batchNumber}: ${json.slice(0, 120)}`,
        );
      }
      const parsed = extractedBatchSchema.parse(rawJson);
      return parsed.records.map(normalizeLeadRecord);
    },
  };
}

async function postChatCompletions(
  batchNumber: number,
  rows: CsvRow[],
): Promise<{ choices?: Array<{ message?: { content?: string } }> }> {
  let lastError: Error | null = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.aiApiKey}`,
          ...(process.env.OPENROUTER_HTTP_REFERER
            ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
            : {}),
          ...(process.env.OPENROUTER_APP_NAME
            ? { "X-Title": process.env.OPENROUTER_APP_NAME }
            : {}),
        },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(),
            },
            {
              role: "user",
              content: JSON.stringify(
                {
                  batchNumber,
                  instruction:
                    "Map each CSV row to the GrowEasy CRM schema. Return JSON with a records array and preserve row order.",
                  rows,
                },
                null,
                2,
              ),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI request failed with status ${response.status}`);
      }

      return (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("AI request failed.");
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error("AI request failed.");
}

function buildSystemPrompt(): string {
  return [
    "You extract CRM leads from arbitrary CSV rows.",
    "Return ONLY valid JSON with this shape: {\"records\": [ ... ] }. No markdown, no code fences, no extra text.",
    "Each input row must produce exactly one output record in the same order.",
    "Skip nothing here; the server will handle invalid or empty rows.",
    "Use only these crm_status values: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE. If unsure, default to DID_NOT_CONNECT.",
    "Use only these data_source values when confident: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots. If no confident match, use empty string.",
    "created_at must be a valid ISO date string parseable by JavaScript's new Date().",
    "For email: use the FIRST email address found in the row for the email field. Append any additional email addresses to crm_note.",
    "For mobile: use the FIRST phone number found for mobile_without_country_code. Extract the country code (e.g. +91) into country_code. Append any additional phone numbers to crm_note.",
    "Put all extra remarks, follow-up notes, extra emails, extra phone numbers, and any unmapped info into crm_note.",
  ].join(" ");
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  // Strip markdown code fence (```json ... ``` or ``` ... ```) if present
  const fenceMatch = trimmed.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n?```\s*$/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  // Also handle opening fence with no language tag on the same line as content
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:\w+)?[\r\n]*/i, "")
      .replace(/[\r\n]*```[\s\S]*$/i, "")
      .trim();
  }
  return trimmed;
}
