import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BTF_ANALYZER_SYSTEM } from "./btfAnalyzerPrompt";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

async function callGateway(
  model: string,
  system: string,
  user: string,
  apiKey: string,
  json = false,
): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
      temperature: 0.4,
    }),
  });
  if (res.status === 429) throw Object.assign(new Error("rate_limit"), { code: "rate_limit" });
  if (res.status === 402) throw Object.assign(new Error("credits"), { code: "credits" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`upstream ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

async function callWithFallback(system: string, user: string, json = false): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI gateway not configured.");
  try {
    return await callGateway(PRIMARY_MODEL, system, user, apiKey, json);
  } catch (e) {
    if ((e as { code?: string }).code === "rate_limit") {
      return await callGateway(FALLBACK_MODEL, system, user, apiKey, json);
    }
    throw e;
  }
}

/* =========================
 * 1. Paste-a-profile qualifier
 * ========================= */

export const ProfileQualifierResultSchema = z.object({
  verdict: z.enum(["SEND_VN", "SKIP", "MAYBE"]),
  verdictLine: z.string().max(200),
  icpMatch: z.enum(["green", "yellow", "red"]),
  market: z.string().max(60),
  predictedTier: z.enum(["DIY", "DWY", "DFY", "unknown"]),
  predictedTierReason: z.string().max(200),
  qualification: z.object({
    decisionMaker: z.number().int().min(-1).max(1),
    hasOffer: z.number().int().min(-1).max(1),
    earningSomething: z.number().int().min(-1).max(1),
    wantsMore: z.number().int().min(-1).max(1),
  }),
  greenFlags: z.array(z.string()).max(8),
  redFlags: z.array(z.string()).max(8),
  personalisationHook: z.string().max(300),
  suggestedFirstLine: z.string().max(300),
  confidence: z.number().min(0).max(1),
});
export type ProfileQualifierResult = z.infer<typeof ProfileQualifierResultSchema>;

const PROFILE_QUALIFIER_SYS = `${BTF_ANALYZER_SYSTEM}

You will be given RAW PASTED CONTENT from a LinkedIn (or other) profile — not a conversation thread. Your job: decide if this person is worth a connection request + VN1 right now.

Return ONLY valid JSON matching this schema (no markdown):
{
  "verdict": "SEND_VN" | "SKIP" | "MAYBE",
  "verdictLine": "<one line starting with ✅ SEND VN — …  /  ❌ SKIP — …  /  ⚠️ MAYBE — …>",
  "icpMatch": "green" | "yellow" | "red",
  "market": "<one of the market buckets or short string>",
  "predictedTier": "DIY" | "DWY" | "DFY" | "unknown",
  "predictedTierReason": "<one sentence>",
  "qualification": {
    "decisionMaker": 1 | 0 | -1,
    "hasOffer": 1 | 0 | -1,
    "earningSomething": 1 | 0 | -1,
    "wantsMore": 1 | 0 | -1
  },
  "greenFlags": ["..."],
  "redFlags": ["..."],
  "personalisationHook": "<one specific real detail from their profile>",
  "suggestedFirstLine": "<the opening sentence of the VN1 referencing the hook>",
  "confidence": 0.0-1.0
}

Verdict order in output is fixed: verdict line FIRST so the user sees ✅/❌ before anything else.`;

export const qualifyProfile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ profileText: z.string().min(10).max(20000) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; result: ProfileQualifierResult } | { ok: false; error: string }> => {
    try {
      const text = await callWithFallback(
        PROFILE_QUALIFIER_SYS,
        `PASTED PROFILE:\n\n${data.profileText}\n\nReturn JSON only.`,
        true,
      );
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) return { ok: false, error: "AI returned malformed output." };
        raw = JSON.parse(m[0]);
      }
      return { ok: true, result: ProfileQualifierResultSchema.parse(raw) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

/* =========================
 * 2. Summarise this prospect (state command)
 * ========================= */

export const summariseProspect = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        prospectName: z.string(),
        stage: z.string().optional(),
        thread: z.string().max(20000),
        history: z.string().max(5000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; summary: string } | { ok: false; error: string }> => {
    const sys = `${BTF_ANALYZER_SYSTEM}

You are answering a "state ${data.prospectName}" command — give a tight situation report. Output in markdown. Sections:

**Where they are:** 1-2 sentences.
**4 qualifiers:** ✓ / ✗ / ? for Decision Maker · Has Offer · Earning Something · Wants More.
**What's confirmed:** bullets.
**What's still unknown:** bullets.
**Predicted tier:** DIY/DWY/DFY + 1 line why.
**Next move:** the exact action to take next.
**Risk:** anything that could kill the deal.

Keep it under 200 words. No fluff.`;
    const user = `PROSPECT: ${data.prospectName}${data.stage ? ` (stage: ${data.stage})` : ""}

THREAD:
${data.thread}

${data.history ? `PRIOR ANALYZER NOTES:\n${data.history}` : ""}`;
    try {
      const text = await callWithFallback(sys, user, false);
      return { ok: true, summary: text.trim() };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
