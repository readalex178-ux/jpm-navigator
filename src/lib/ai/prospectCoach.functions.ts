import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BTF_SYSTEM } from "./btfFramework";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

const ProspectContext = z.object({
  name: z.string().max(200),
  platform: z.string().max(40),
  niche: z.string().max(400).default(""),
  stage: z.string().max(40),
  stageEnteredAt: z.string().max(40),
  lastTouchAt: z.string().max(40),
  tier: z.string().max(20),
  bio: z.string().max(4000).default(""),
  signals: z.array(z.string().max(80)).max(50).default([]),
  bant: z
    .object({
      need: z.number().min(0).max(2),
      timeline: z.number().min(0).max(2),
      authority: z.number().min(0).max(2),
      budget: z.number().min(0).max(2),
    })
    .partial()
    .default({}),
  qualScore: z.number().min(0).max(100).default(0),
  messages: z
    .array(
      z.object({
        fromMe: z.boolean(),
        type: z.string().max(20),
        date: z.string().max(40),
        text: z.string().max(4000),
      }),
    )
    .max(80)
    .default([]),
  followUpAt: z.string().max(40).nullable().optional(),
});

type ProspectContextT = z.infer<typeof ProspectContext>;

function buildContextBlock(p: ProspectContextT): string {
  const conv = p.messages
    .slice(-30)
    .map(
      (m) =>
        `[${m.date.slice(0, 16).replace("T", " ")}] ${m.fromMe ? "ME" : "THEM"} (${m.type}): ${m.text}`,
    )
    .join("\n");
  return [
    `Prospect: ${p.name}`,
    `Platform: ${p.platform} · Niche: ${p.niche || "—"}`,
    `Stage: ${p.stage} (entered ${p.stageEnteredAt.slice(0, 10)})`,
    `Last touch: ${p.lastTouchAt.slice(0, 10)}`,
    `Tier target: ${p.tier} · Qual score: ${p.qualScore}/100`,
    `BANT: need=${p.bant.need ?? 0} timeline=${p.bant.timeline ?? 0} authority=${p.bant.authority ?? 0} budget=${p.bant.budget ?? 0}`,
    `Buying signals: ${p.signals.join(", ") || "none"}`,
    `Bio: ${p.bio || "—"}`,
    p.followUpAt ? `Existing follow-up scheduled: ${p.followUpAt}` : "",
    "",
    "Conversation (oldest first):",
    conv || "(no messages yet)",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGateway(
  model: string,
  body: object,
  apiKey: string,
): Promise<any> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, ...body }),
  });
  if (res.status === 429) throw Object.assign(new Error("rate_limit"), { code: "rate_limit" });
  if (res.status === 402) throw Object.assign(new Error("credits"), { code: "credits" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error(`[prospectCoach] upstream ${res.status}: ${t.slice(0, 500)}`);
    throw Object.assign(new Error("AI service temporarily unavailable."), { code: "upstream" });
  }
  return res.json();
}

const COACH_SYSTEM = `${BTF_SYSTEM}

=== COACH MODE ===
You are the user's BTF (Behind the Funnel) setter coach for ONE prospect.
You see the full conversation, stage, BANT, signals. You answer like a sharp sales mentor — tight, tactical, no fluff.

Rules:
- Never claim to send anything. The user sends all messages themselves.
- When the user tells you the prospect "left me on read", "ghosted", "no reply", "ignored", "didn't get back" — DO NOT ask clarifying questions. Confirm the follow-up timing in one sentence; the app sets the reminder automatically.
- BTF LinkedIn cadence: Day 0 Connect → Day 3 VN1 → Day 7 VN2 → Day 12 text. Calendar Sent follow-up ~2d. Replied = same day. Nurturing weekly.
- Stage = "VN1 Sent" branching:
    • If user says VN1 was SEEN/READ but no reply → propose VN2 in ~2d (max 4d after VN1).
    • If user says VN1 was NOT seen → ask whether to (a) bump with a short re-engage text in 2d, or (b) wait another 2d and re-check. Give the trade-off in one line.
    • If user hasn't said either → ask: "Has she/he seen VN1 yet?" then branch.
- When asked to draft a message, write it in plain text, paste-ready.
- Use markdown sparingly: bold the key recommendation, short bullets where useful.
- Keep answers under ~150 words unless drafting a message.`;

/**
 * Chat with the AI coach for one prospect. Stateless — caller passes full
 * message history each call.
 */
export const prospectCoachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        context: ProspectContext,
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(8000),
            }),
          )
          .min(1)
          .max(40),
      })
      .parse(input),
  )
  .handler(
    async ({ data }): Promise<{ ok: true; content: string } | { ok: false; error: string }> => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ok: false, error: "AI gateway not configured." };
      const messages = [
        { role: "system", content: COACH_SYSTEM },
        { role: "system", content: buildContextBlock(data.context) },
        ...data.messages,
      ];
      const body = { messages, temperature: 0.6 };
      try {
        const j = await callGateway(PRIMARY_MODEL, body, apiKey);
        const content: string = j.choices?.[0]?.message?.content ?? "";
        return { ok: true, content };
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "rate_limit") {
          try {
            const j = await callGateway(FALLBACK_MODEL, body, apiKey);
            return { ok: true, content: j.choices?.[0]?.message?.content ?? "" };
          } catch (e2) {
            console.error("[prospectCoach] fallback failed", e2);
            return { ok: false, error: "AI service temporarily unavailable." };
          }
        }
        console.error("[prospectCoach] failed", e);
        return { ok: false, error: "AI service temporarily unavailable." };
      }
    },
  );

/**
 * Ask the model for a structured follow-up suggestion (date + reason).
 * Returns ISO timestamp; the UI requires explicit user confirmation before
 * saving it to the prospect (NO automation).
 */
export const suggestFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ context: ProspectContext }).parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; followUpAt: string; reason: string }
      | { ok: false; error: string }
    > => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ok: false, error: "AI gateway not configured." };
      const now = new Date().toISOString();
      const messages = [
        {
          role: "system",
          content: `${COACH_SYSTEM}\n\nNow: ${now}\n\nYou MUST return a JSON object {"followUpAt": "<ISO 8601>", "reason": "<short reason, <120 chars>"}. followUpAt must be in the future relative to "now".`,
        },
        { role: "system", content: buildContextBlock(data.context) },
        {
          role: "user",
          content:
            "Based on stage, last touch, and the conversation, when should I follow up with this prospect? Return only the JSON object.",
        },
      ];
      try {
        const j = await callGateway(
          PRIMARY_MODEL,
          { messages, temperature: 0.3, response_format: { type: "json_object" } },
          apiKey,
        );
        const raw: string = j.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as { followUpAt?: string; reason?: string };
        const at = parsed.followUpAt ? new Date(parsed.followUpAt) : null;
        if (!at || Number.isNaN(at.getTime())) {
          return { ok: false, error: "AI returned an invalid date." };
        }
        return {
          ok: true,
          followUpAt: at.toISOString(),
          reason: (parsed.reason ?? "Follow-up").slice(0, 200),
        };
      } catch (e) {
        console.error("[suggestFollowUp] failed", e);
        return { ok: false, error: "AI service temporarily unavailable." };
      }
    },
  );
