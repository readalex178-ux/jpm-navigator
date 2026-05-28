import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYS = `You suggest the next follow-up cadence for a B2B outbound prospect.
You are given:
- platform (linkedin | instagram | facebook | x | other)
- tier (DIY | DWY | DFY)
- stage
- last_activity_type
- context (recent activity summary)

Return JSON ONLY: {"days": <integer 1..21>, "reason": "<one short sentence, ≤120 chars>"}
Rules of thumb (do not violate):
- After a VN with no reply: 2–3 days.
- After a text reply or warm signal: next day.
- After a calendar sent / call booked: 1 day check-in.
- DFY prospects get tighter cadence than DIY.
- Never auto-send; this is a suggestion only.
- Never recommend > 14 days unless stage is Nurturing / Cold.`;

export const suggestFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        context: z.string().min(20).max(6000),
        platform: z.string().max(40),
        tier: z.string().max(20),
        stage: z.string().max(40),
        lastActivityType: z.string().max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; days: number; reason: string; followUpAt: string } | { ok: false; error: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "AI gateway not configured." };
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYS },
            {
              role: "user",
              content: `platform=${data.platform}\ntier=${data.tier}\nstage=${data.stage}\nlast_activity_type=${data.lastActivityType ?? "unknown"}\n\n${data.context}\n\nReturn JSON only.`,
            },
          ],
        }),
      });
      if (res.status === 429) return { ok: false, error: "Rate limited — wait a moment and retry." };
      if (res.status === 402) return { ok: false, error: "AI credits exhausted." };
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error(`[suggestFollowUp] upstream ${res.status}: ${t.slice(0, 300)}`);
        return { ok: false, error: "AI service temporarily unavailable." };
      }
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = j.choices?.[0]?.message?.content ?? "";
      let parsed: { days: number; reason: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) return { ok: false, error: "AI returned malformed output." };
        parsed = JSON.parse(m[0]);
      }
      const days = Math.max(1, Math.min(21, Math.round(parsed.days)));
      const reason = (parsed.reason ?? "Follow-up suggested.").toString().slice(0, 160);
      const at = new Date();
      at.setDate(at.getDate() + days);
      at.setHours(9, 0, 0, 0);
      return { ok: true, days, reason, followUpAt: at.toISOString() };
    } catch (e) {
      console.error("[suggestFollowUp] failed", e);
      return { ok: false, error: "AI service temporarily unavailable." };
    }
  });
