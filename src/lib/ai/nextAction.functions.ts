import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { BTF_SYSTEM } from "./btfFramework";
import { BTF_ANALYZER_SYSTEM } from "./btfAnalyzerPrompt";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

const NEXT_ACTION_SYS = `${BTF_SYSTEM}

=== ANALYZER LAYER ===
${BTF_ANALYZER_SYSTEM}

=== NEXT-ACTION COACH ===
You decide the ONE highest-leverage next move for this prospect, based on their current stage and the latest reply signals (or lack of reply).

CRITICAL: You NEVER send anything. You only suggest. The setter (ME) reviews, edits and acts manually.

Pick exactly ONE action type from:
- "send_reply"        — There is a clear opening to message them now. Provide a paste-ready draft.
- "schedule_follow_up"— They haven't replied or need time. Pick a future ISO timestamp.
- "move_stage"        — A signal in their last message clearly changes their stage (e.g. they booked, they ghosted past cadence, they qualified).
- "log_activity"      — A non-message action is required next (e.g. comment on their post, send connection, prep for call).
- "wait"              — Doing nothing is correct right now (very recent message, mid-cadence delay not yet hit).

Stage cadence reference (BTF LinkedIn):
Day 0 Connect → Day 3 VN1 → Day 7 VN2 → Day 12 text. Calendar Sent FU ~2d. Replied = same day. Nurturing weekly. Ghosted past cadence → break-up text or move to Inactive.

Reply-signal reading:
- Positive interest, asks question, agrees, gives time → send_reply or move_stage.
- Objection ("not now", "send info") → send_reply (acknowledge + reframe).
- Silence past cadence window → schedule_follow_up OR move to Nurturing if past 2nd nudge.
- Booked / declined → move_stage.
- Very recent (<24h) and you already replied → wait.

Return JSON ONLY (no markdown, no preamble), matching exactly this schema:
{
  "type": "send_reply" | "schedule_follow_up" | "move_stage" | "log_activity" | "wait",
  "urgency": "now" | "today" | "this_week" | "later",
  "title": "<≤60 chars, action-oriented, e.g. 'Send VN2 — re-engage on offer pain'>",
  "reason": "<2-3 short sentences. Cite the latest reply signal + stage cadence rule.>",
  "confidence": <0.0-1.0>,
  "draftMessage": "<paste-ready message, ≤180 words. Only for send_reply, else empty string>",
  "activityType": "VN" | "text" | "email" | "comment" | "call" | "note" | "",
  "suggestedStage": "<one of the BTF stages, only for move_stage, else empty string>",
  "followUpAt": "<ISO 8601 in the future, only for schedule_follow_up, else empty string>",
  "followUpReason": "<≤80 chars, only for schedule_follow_up, else empty string>"
}

Never invent facts. Never use placeholders like [name] or {{...}}. If unsure, prefer "wait" with a short reason.`;

const ConvMessage = z.object({
  fromMe: z.boolean(),
  type: z.string().max(20),
  date: z.string().max(40),
  text: z.string().max(4000),
});

const InputSchema = z.object({
  prospectName: z.string().min(1).max(200),
  platform: z.string().max(40),
  niche: z.string().max(400).default(""),
  stage: z.string().max(40),
  stageEnteredAt: z.string().max(40),
  lastTouchAt: z.string().max(40),
  tier: z.string().max(20),
  bio: z.string().max(4000).default(""),
  signals: z.array(z.string().max(80)).max(50).default([]),
  qualScore: z.number().min(0).max(100).default(0),
  bant: z
    .object({
      need: z.number().min(0).max(2),
      timeline: z.number().min(0).max(2),
      authority: z.number().min(0).max(2),
      budget: z.number().min(0).max(2),
    })
    .partial()
    .default({}),
  messages: z.array(ConvMessage).max(80).default([]),
  followUpAt: z.string().max(40).nullable().optional(),
});

const ActionResultSchema = z.object({
  type: z.enum(["send_reply", "schedule_follow_up", "move_stage", "log_activity", "wait"]),
  urgency: z.enum(["now", "today", "this_week", "later"]).default("today"),
  title: z.string().min(1).max(120),
  reason: z.string().min(1).max(600),
  confidence: z.number().min(0).max(1).default(0.6),
  draftMessage: z.string().max(3000).default(""),
  activityType: z.string().max(20).default(""),
  suggestedStage: z.string().max(40).default(""),
  followUpAt: z.string().max(40).default(""),
  followUpReason: z.string().max(160).default(""),
});

export type NextAction = z.infer<typeof ActionResultSchema>;

async function callGateway(model: string, system: string, user: string, apiKey: string) {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });
  if (res.status === 429)
    throw Object.assign(new Error("AI rate limit — try again in a moment."), { code: "rate_limit" });
  if (res.status === 402)
    throw Object.assign(new Error("AI credits exhausted. Add credits in Settings."), {
      code: "credits",
    });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`[nextAction] upstream ${res.status}: ${txt.slice(0, 500)}`);
    throw Object.assign(new Error("AI service temporarily unavailable."), { code: "upstream" });
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

export const suggestNextAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: true; result: NextAction } | { ok: false; error: string }> => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ok: false, error: "AI gateway not configured." };

      const now = new Date().toISOString();
      const convo = data.messages
        .slice(-30)
        .map(
          (m) =>
            `[${m.date.slice(0, 16).replace("T", " ")}] ${m.fromMe ? "ME" : "THEM"} (${m.type}): ${m.text}`,
        )
        .join("\n");
      const last = data.messages[data.messages.length - 1];
      const lastLine = last
        ? `${last.fromMe ? "ME" : "THEM"} on ${last.date.slice(0, 16)}: ${last.text.slice(0, 200)}`
        : "(no messages yet)";

      const user = `Now: ${now}

PROSPECT: ${data.prospectName}
Platform: ${data.platform} · Niche: ${data.niche || "—"}
Stage: ${data.stage} (entered ${data.stageEnteredAt.slice(0, 10)})
Last touch: ${data.lastTouchAt.slice(0, 10)}
Target tier: ${data.tier} · Qual score: ${data.qualScore}/100
BANT: need=${data.bant.need ?? 0} timeline=${data.bant.timeline ?? 0} authority=${data.bant.authority ?? 0} budget=${data.bant.budget ?? 0}
Buying signals: ${data.signals.join(", ") || "none"}
${data.followUpAt ? `Existing follow-up: ${data.followUpAt}` : ""}

LATEST MESSAGE:
${lastLine}

FULL CONVERSATION (oldest → newest):
${convo || "(no messages yet)"}

Decide the ONE highest-leverage next action. Return JSON only.`;

      try {
        let text: string;
        try {
          text = await callGateway(PRIMARY_MODEL, NEXT_ACTION_SYS, user, apiKey);
        } catch (e) {
          if ((e as { code?: string }).code === "rate_limit") {
            text = await callGateway(FALLBACK_MODEL, NEXT_ACTION_SYS, user, apiKey);
          } else throw e;
        }
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (!m) return { ok: false, error: "AI returned malformed output." };
          raw = JSON.parse(m[0]);
        }
        const parsed = ActionResultSchema.parse(raw);

        // Sanity: future timestamp if schedule_follow_up
        if (parsed.type === "schedule_follow_up") {
          const t = parsed.followUpAt ? new Date(parsed.followUpAt) : null;
          if (!t || Number.isNaN(t.getTime()) || t.getTime() < Date.now()) {
            const fallback = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
            parsed.followUpAt = fallback;
            if (!parsed.followUpReason) parsed.followUpReason = "Default 2-day follow-up";
          }
        }

        // Strip placeholders from any draft
        parsed.draftMessage = parsed.draftMessage
          .replace(/\[[^\]]*\]|\{\{[^}]*\}\}/g, "")
          .replace(/\s{2,}/g, " ")
          .trim();

        return { ok: true, result: parsed };
      } catch (e) {
        console.error("[suggestNextAction] failed", e);
        const known = (e as Error).message;
        const safe = known.startsWith("AI ") ? known : "AI service temporarily unavailable.";
        return { ok: false, error: safe };
      }
    },
  );
