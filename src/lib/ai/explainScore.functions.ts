import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYS = `You are an inside-sales coach explaining a prospect's qualification score.
Given a prospect context block and their current score, write 2–4 short sentences in plain English explaining:
1) Why the score is where it is (cite the strongest 1–2 factors).
2) The single highest-leverage move to push it up.
No bullets, no headers, no jargon. Direct, confident, under 90 words.`;

export const explainQualScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        context: z.string().min(20).max(8000),
        score: z.number().int().min(0).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; explanation: string } | { ok: false; error: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "AI gateway not configured." };
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.4,
          messages: [
            { role: "system", content: SYS },
            { role: "user", content: `${data.context}\n\nRecorded score: ${data.score}/100\n\nExplain.` },
          ],
        }),
      });
      if (res.status === 429) return { ok: false, error: "Rate limited — wait a moment and retry." };
      if (res.status === 402) return { ok: false, error: "AI credits exhausted." };
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error(`[explainScore] upstream ${res.status}: ${t.slice(0, 300)}`);
        return { ok: false, error: "AI service temporarily unavailable." };
      }
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const explanation = (j.choices?.[0]?.message?.content ?? "").trim();
      if (!explanation) return { ok: false, error: "Empty response." };
      return { ok: true, explanation };
    } catch (e) {
      console.error("[explainScore] failed", e);
      return { ok: false, error: "AI service temporarily unavailable." };
    }
  });
