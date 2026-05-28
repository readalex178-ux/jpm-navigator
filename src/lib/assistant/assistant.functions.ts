import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STAGES } from "@/lib/btf/types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const ProspectCtx = z.object({
  id: z.string(),
  name: z.string(),
  niche: z.string().optional().nullable(),
  stage: z.string(),
  lastTouchAt: z.string().optional().nullable(),
});

const InputSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .default([]),
  prospects: z.array(ProspectCtx).max(500),
});

const SYSTEM = `You are the inline assistant for a sales setter CRM called BTF Setter OS.
The user tells you what they just DID (already happened in real life) or asks a question about their pipeline.
You NEVER send messages on the user's behalf — you only structure what they tell you so a button can log it.

You must respond with STRICT JSON matching this shape:
{
  "reply": "<short conversational reply, max 2 sentences>",
  "proposals": [ ... zero or more action proposals ... ]
}

Proposal kinds:
1. {"kind":"log_activity","prospectQuery":"<name as user said it>","activityType":"VN|text|email|comment|like|call|note","note":"<short summary of what was said/done>"}
2. {"kind":"update_stage","prospectQuery":"<name>","stage":"<one of: ${STAGES.join(", ")}>"}
3. {"kind":"add_prospect","name":"<full name>","platform":"linkedin|instagram|tiktok|facebook|x|email","niche":"<optional>","notes":"<optional>"}
4. {"kind":"answer_only"} — use this when the user only asked a question and no write is implied.

Rules:
- If the user is asking a question (who's overdue, what did I last send X) — set proposals to [] or use answer_only, and put the answer in "reply" using the prospect context provided.
- If the user mentions BOTH logging an activity AND a stage change, return both proposals.
- For prospectQuery, use the exact name as the user typed it. Do NOT invent IDs. The client will fuzzy-match.
- Activity type "VN" = voice note. Use "text" for typed DMs, "call" for phone calls, "note" for internal memos.
- Stages must be spelled EXACTLY as listed above.
- Keep "reply" short, casual, encouraging. No emojis.`;

export const assistantChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; content: string }
      | { ok: false; code: string; error: string }
    > => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) {
        return {
          ok: false,
          code: "not_configured",
          error: "Lovable AI gateway not configured.",
        };
      }

      const ctxLines = data.prospects
        .slice(0, 200)
        .map(
          (p) =>
            `- ${p.name} | ${p.stage}${p.niche ? ` | ${p.niche}` : ""}${p.lastTouchAt ? ` | last touch ${p.lastTouchAt.slice(0, 10)}` : ""}`,
        )
        .join("\n");

      const messages = [
        { role: "system", content: SYSTEM },
        {
          role: "system",
          content: `Current prospects (${data.prospects.length}):\n${ctxLines || "(none yet)"}`,
        },
        ...data.history,
        { role: "user", content: data.message },
      ];

      try {
        const res = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        });
        if (res.status === 429) {
          return { ok: false, code: "rate_limit", error: "Rate limit hit. Try again in a moment." };
        }
        if (res.status === 402) {
          return { ok: false, code: "credits", error: "AI credits exhausted." };
        }
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.error(`[assistant] upstream ${res.status}: ${t.slice(0, 400)}`);
          return { ok: false, code: "upstream", error: "AI service temporarily unavailable." };
        }
        const j = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = j.choices?.[0]?.message?.content ?? "";
        return { ok: true, content };
      } catch (e) {
        console.error("[assistant] failed", e);
        return { ok: false, code: "upstream", error: "AI service temporarily unavailable." };
      }
    },
  );
