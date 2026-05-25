import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { BTF_ANALYZER_SYSTEM } from "./btfAnalyzerPrompt";
import { BTF_SYSTEM } from "./btfFramework";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

const SUGGEST_REPLIES_SYS = `${BTF_SYSTEM}

=== ANALYZER LAYER ===
${BTF_ANALYZER_SYSTEM}

You are an AI co-pilot helping a setter (ME) decide what to send next to a prospect (THEM).
You DO NOT send messages. You ONLY suggest. The setter will read, edit, and send manually.

Given the running conversation, propose EXACTLY 3 distinct reply options the setter could send next.
Each suggestion must take a DIFFERENT angle (e.g. one direct/qualifying, one curious/soft, one bold/closing).
Never invent facts. Never use placeholders like [name] or {{...}}. Each draft must be ready to paste verbatim.

Return JSON ONLY (no markdown), matching this schema:
{
  "suggestions": [
    {
      "type": "VN" | "text" | "email" | "comment" | "call" | "note",
      "angle": "<short 2-4 word label, e.g. 'Direct qualifier', 'Soft curiosity', 'Bold close'>",
      "content": "<verbatim message ≤150 words>",
      "coaching_note": "<one sentence explaining why this angle, when to pick it>"
    },
    { ... },
    { ... }
  ]
}`;

const SuggestionSchema = z.object({
  type: z.string().max(20),
  angle: z.string().max(60),
  content: z.string().min(1).max(2000),
  coaching_note: z.string().max(400),
});

export const SuggestRepliesResultSchema = z.object({
  suggestions: z.array(SuggestionSchema).min(1).max(3),
});
export type SuggestRepliesResult = z.infer<typeof SuggestRepliesResultSchema>;

const ConvMessageSchema = z.object({
  fromMe: z.boolean(),
  type: z.string().max(20),
  date: z.string().max(40),
  text: z.string().max(4000),
});

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
      temperature: 0.7,
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
    console.error(`[suggestReplies] upstream ${res.status}: ${txt.slice(0, 500)}`);
    throw Object.assign(new Error("AI service temporarily unavailable."), { code: "upstream" });
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

export const suggestReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; result: SuggestRepliesResult } | { ok: false; error: string }> => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ok: false, error: "AI gateway not configured." };

      const convo = data.messages
        .slice(-30)
        .map(
          (m) =>
            `[${m.date.slice(0, 16)}] ${m.fromMe ? "ME" : "THEM"} (${m.type}): ${m.text}`,
        )
        .join("\n");
      const user = `PROSPECT: ${data.prospectName}
Platform: ${data.platform ?? "—"}
Niche: ${data.niche ?? "—"}
Stage: ${data.stage}
Target tier: ${data.tier ?? "—"}
Buying signals: ${(data.signals ?? []).join(", ") || "none"}
Bio: ${data.bio ?? "—"}

CONVERSATION (chronological):
${convo || "(no messages yet — suggest 3 cold openers)"}

Return JSON only — exactly 3 suggestions, each a different angle.`;

      try {
        let text: string;
        try {
          text = await callGateway(PRIMARY_MODEL, SUGGEST_REPLIES_SYS, user, apiKey);
        } catch (e) {
          if ((e as { code?: string }).code === "rate_limit") {
            text = await callGateway(FALLBACK_MODEL, SUGGEST_REPLIES_SYS, user, apiKey);
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
        const parsed = SuggestRepliesResultSchema.parse(raw);
        parsed.suggestions = parsed.suggestions.map((s) => ({
          ...s,
          content: s.content
            .replace(/\[[^\]]*\]|\{\{[^}]*\}\}/g, "")
            .replace(/\s{2,}/g, " ")
            .trim(),
        }));
        return { ok: true, result: parsed };
      } catch (e) {
        console.error("[suggestReplies] failed", e);
        const known = (e as Error).message;
        const safe = known.startsWith("AI ") ? known : "AI service temporarily unavailable.";
        return { ok: false, error: safe };
      }
    },
  );
