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

/* =========================
 * 3. Full BTF VN1 script builder (paste profile → ≤150 word VN1, no brackets)
 * ========================= */

const VN1_BUILDER_SYS = `${BTF_ANALYZER_SYSTEM}

You will be given RAW PASTED CONTENT from a LinkedIn profile. Your job: produce ONE ready-to-record Voice Note #1 script that the setter can read out loud verbatim.

HARD RULES — these are non-negotiable, the script is rejected if any are broken:
- Maximum 150 words. Count them.
- NO brackets of any kind. No "[Name]", no "[pause]", no "{{first_name}}", no parenthetical pacing cues. The script is final spoken text only.
- NO placeholders. Resolve their actual first name from the profile. If you genuinely cannot find a first name, omit the name entirely and open with "Hey".
- Must follow the BTF Master Script structure in this exact order:
  1) HOOK — "Hey <first name>, figured I'd send a quick voice note so you didn't have to read a whole book here."
  2) PERSONALISATION — 2-3 sentences citing ONE specific real detail from their profile (offer, headline, recent post, role). Prove you actually looked.
  3) BRIDGE — must use the literal number 19 founders/service providers and the phrase "more direct, one-on-one conversations" and "without relying on paid ads".
  4) RELEVANCE — one sentence connecting BTF to their world / market (use the right market trust line if obvious).
  5) CLOSE — default: "Let me know if you're open to hearing how it works?"
- Casual, human, conversational. Zero corporate speak. No emojis. No exclamation marks unless absolutely warranted.
- Never name the product. Never say "podcast". Never mention pricing.

Return JSON ONLY:
{
  "firstName": "<the first name you used, or empty string>",
  "wordCount": <integer count of words in script>,
  "script": "<the full final spoken text, plain prose, no brackets, no labels>",
  "personalisationDetail": "<the specific real detail you anchored on>",
  "market": "<market bucket if identifiable>",
  "warnings": ["<any rule you almost broke or had to skip>"]
}`;

export const VN1ScriptResultSchema = z.object({
  firstName: z.string().max(60),
  wordCount: z.number().int().min(0).max(500),
  script: z.string().min(10).max(2000),
  personalisationDetail: z.string().max(400),
  market: z.string().max(80),
  warnings: z.array(z.string()).max(8).default([]),
});
export type VN1ScriptResult = z.infer<typeof VN1ScriptResultSchema>;

export const buildVN1Script = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ profileText: z.string().min(10).max(20000) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; result: VN1ScriptResult } | { ok: false; error: string }> => {
    try {
      const text = await callWithFallback(
        VN1_BUILDER_SYS,
        `PROFILE:\n\n${data.profileText}\n\nReturn JSON only.`,
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
      const parsed = VN1ScriptResultSchema.parse(raw);
      // Server-side sanity: strip any bracketed cues that slipped through.
      parsed.script = parsed.script.replace(/\[[^\]]*\]|\{\{[^}]*\}\}/g, "").replace(/\s{2,}/g, " ").trim();
      parsed.wordCount = parsed.script.split(/\s+/).filter(Boolean).length;
      return { ok: true, result: parsed };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

/* =========================
 * 4. Paste-a-thread analyser (no extension required)
 * ========================= */

const PASTED_THREAD_SYS = `${BTF_ANALYZER_SYSTEM}

You will be given a RAW PASTED conversation thread or voice-note transcript between a setter (ME) and a LinkedIn prospect (THEM). Lines may be labelled "Me:" / "Them:" / "Prospect:" or just be a transcript of one VN. Infer who is speaking.

Return JSON ONLY:
{
  "stage": "<one of: not_connected | connection_sent | accepted_no_vn | vn1_sent | replied_voice | replied_text | vn2_due | day7_followup_due | day12_text_due | objection_raised | ready_to_book | booked | ghost>",
  "verdictLine": "<one of: ✅ SEND VN2 — … / ✅ SEND CALENDAR — … / ✅ BOOK — … / ⚠️ OBJECTION — … / ❌ WALK AWAY — … / 🔁 RE-ENGAGE — … / ⏳ WAIT — …>",
  "greenFlags": ["..."],
  "redFlags": ["..."],
  "objection": "<none | time | already_have_system | cost | is_this_sales | not_interested | send_info | other>",
  "nextMove": "<exact next action in plain language>",
  "draftMessage": "<the verbatim message or VN script to send next, ≤150 words, no brackets, no placeholders. Empty string if the verdict is WALK AWAY or WAIT.>",
  "reasoning": "<2-3 sentences explaining the call>",
  "confidence": 0.0-1.0
}`;

export const PastedThreadResultSchema = z.object({
  stage: z.string().max(60),
  verdictLine: z.string().max(200),
  greenFlags: z.array(z.string()).max(8).default([]),
  redFlags: z.array(z.string()).max(8).default([]),
  objection: z.string().max(40),
  nextMove: z.string().max(280),
  draftMessage: z.string().max(2000),
  reasoning: z.string().max(600),
  confidence: z.number().min(0).max(1),
});
export type PastedThreadResult = z.infer<typeof PastedThreadResultSchema>;

export const analyzePastedThread = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ threadText: z.string().min(5).max(20000) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; result: PastedThreadResult } | { ok: false; error: string }> => {
    try {
      const text = await callWithFallback(
        PASTED_THREAD_SYS,
        `THREAD / TRANSCRIPT:\n\n${data.threadText}\n\nReturn JSON only.`,
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
      const parsed = PastedThreadResultSchema.parse(raw);
      parsed.draftMessage = parsed.draftMessage.replace(/\[[^\]]*\]|\{\{[^}]*\}\}/g, "").replace(/\s{2,}/g, " ").trim();
      return { ok: true, result: parsed };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

/* =========================
 * 5. Conversation-aware next-move co-pilot
 *    Reads the running conversation log for a prospect and decides what to send next.
 * ========================= */

const NEXT_MOVE_SYS = `${BTF_ANALYZER_SYSTEM}

You are reading a running conversation between a setter (ME) and a prospect (THEM), plus the prospect's profile and buying signals. Decide the single best next move and write the exact message to send.

Return JSON ONLY (no markdown):
{
  "verdictLine": "<one line starting with ✅ / ⚠️ / ❌ / 🔁 / ⏳ + a short verdict>",
  "stage": "<one of: Found | Connected | VN1 Sent | Replied | VN2 Sent | Calendar Sent | Call Booked | No Show | Nurturing | Re-Engaged | Closed | Cold>",
  "nextMove": "<the exact next action in plain English, one sentence>",
  "draftMessage": "<the verbatim message to send next, ≤150 words, no brackets, no placeholders. Empty string if WAIT or WALK AWAY.>",
  "suggestedActivityType": "<one of: VN | text | email | comment | call | note>",
  "reasoning": "<2-3 sentences explaining the call, referencing the most recent prospect message>",
  "confidence": 0.0-1.0
}`;

export const NextMoveResultSchema = z.object({
  verdictLine: z.string().max(200),
  stage: z.string().max(40),
  nextMove: z.string().max(300),
  draftMessage: z.string().max(2000),
  suggestedActivityType: z.string().max(20),
  reasoning: z.string().max(600),
  confidence: z.number().min(0).max(1),
});
export type NextMoveResult = z.infer<typeof NextMoveResultSchema>;

const ConvMessageSchema = z.object({
  fromMe: z.boolean(),
  type: z.string().max(20),
  date: z.string().max(40),
  text: z.string().max(4000),
});

export const nextMoveFromConversation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        prospectName: z.string().min(1).max(120),
        platform: z.string().max(40).optional(),
        niche: z.string().max(200).optional(),
        stage: z.string().max(40),
        tier: z.string().max(20).optional(),
        bio: z.string().max(4000).optional(),
        signals: z.array(z.string()).max(20).optional(),
        messages: z.array(ConvMessageSchema).max(60),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; result: NextMoveResult } | { ok: false; error: string }> => {
    try {
      const convo = data.messages
        .slice(-30)
        .map((m) => `[${m.date.slice(0, 16)}] ${m.fromMe ? "ME" : "THEM"} (${m.type}): ${m.text}`)
        .join("\n");
      const user = `PROSPECT: ${data.prospectName}
Platform: ${data.platform ?? "—"}
Niche: ${data.niche ?? "—"}
Stage: ${data.stage}
Target tier: ${data.tier ?? "—"}
Buying signals: ${(data.signals ?? []).join(", ") || "none"}
Bio: ${data.bio ?? "—"}

CONVERSATION (chronological):
${convo || "(no messages yet)"}

Return JSON only.`;
      const text = await callWithFallback(NEXT_MOVE_SYS, user, true);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) return { ok: false, error: "AI returned malformed output." };
        raw = JSON.parse(m[0]);
      }
      const parsed = NextMoveResultSchema.parse(raw);
      parsed.draftMessage = parsed.draftMessage
        .replace(/\[[^\]]*\]|\{\{[^}]*\}\}/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return { ok: true, result: parsed };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

