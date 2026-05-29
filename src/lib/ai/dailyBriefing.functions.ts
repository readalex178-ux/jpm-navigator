import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { BTF_SYSTEM } from "./btfFramework";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-flash-lite";

const SYS = `${BTF_SYSTEM}

=== DAILY BRIEFING COACH ===
You write a SHORT, punchy morning briefing for a BTF setter. You NEVER send anything or schedule anything — you only describe the state and recommend priorities the setter will action manually.

Return JSON ONLY matching exactly:
{
  "headline": "<≤80 chars, today's one-liner — direct, no fluff>",
  "priorities": [
    { "title": "<≤60 chars action>", "why": "<≤120 chars reason citing real numbers>" }
  ],
  "hottest": "<≤140 chars — name the single hottest prospect + why, or '' if none>",
  "pace": "<≤120 chars — monthly commission pace vs target, plain English>",
  "warning": "<≤140 chars — biggest risk today (overdue, ghosted, missed cadence), or '' if clean>"
}

3-5 priorities max. No emojis. No markdown. No placeholders.`;

const InputSchema = z.object({
  date: z.string().max(20),
  overdueCount: z.number().min(0),
  dueTodayCount: z.number().min(0),
  hottestProspect: z
    .object({
      name: z.string().max(120),
      stage: z.string().max(40),
      qualScore: z.number(),
      tier: z.string().max(10),
      daysSinceTouch: z.number(),
    })
    .nullable(),
  overdueFollowUps: z.number().min(0),
  unclaimedGhl: z.number().min(0),
  callsBookedThisWeek: z.number().min(0),
  weeklyVnSent: z.number().min(0),
  weeklyVnTarget: z.number().min(0),
  mtdCommission: z.number().min(0),
  monthlyTarget: z.number().min(0),
  projectedCommission: z.number().min(0),
  dfyToGoal: z.number().min(0),
  dayOfMonth: z.number().min(1).max(31),
  daysInMonth: z.number().min(28).max(31),
});

const ResultSchema = z.object({
  headline: z.string().min(1).max(160),
  priorities: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        why: z.string().min(0).max(240),
      }),
    )
    .max(6)
    .default([]),
  hottest: z.string().max(280).default(""),
  pace: z.string().max(240).default(""),
  warning: z.string().max(280).default(""),
});

export type DailyBriefing = z.infer<typeof ResultSchema>;

export const generateDailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; result: DailyBriefing } | { ok: false; error: string }> => {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ok: false, error: "AI gateway not configured." };

      const user = `Date: ${data.date} (day ${data.dayOfMonth} of ${data.daysInMonth})

QUEUE
- Overdue prospects: ${data.overdueCount}
- Due today: ${data.dueTodayCount}
- Overdue follow-ups: ${data.overdueFollowUps}
- Unclaimed GHL booked calls: ${data.unclaimedGhl}

HOTTEST
${
  data.hottestProspect
    ? `${data.hottestProspect.name} · ${data.hottestProspect.stage} · qual ${data.hottestProspect.qualScore} · ${data.hottestProspect.tier} · ${data.hottestProspect.daysSinceTouch}d since touch`
    : "(no active prospects)"
}

WEEK
- Calls booked this week: ${data.callsBookedThisWeek}
- VNs sent this week: ${data.weeklyVnSent} / target ${data.weeklyVnTarget}

MONTH
- MTD commission: $${data.mtdCommission}
- Target: $${data.monthlyTarget}
- Projected EOM: $${data.projectedCommission}
- DFY closes to goal: ${data.dfyToGoal}

Write the briefing as JSON.`;

      async function call(model: string) {
        const res = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYS },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
            temperature: 0.5,
          }),
        });
        if (res.status === 429) throw Object.assign(new Error("AI rate limit."), { code: "rl" });
        if (res.status === 402)
          throw Object.assign(new Error("AI credits exhausted."), { code: "credits" });
        if (!res.ok) throw new Error(`upstream ${res.status}`);
        const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return j.choices?.[0]?.message?.content ?? "";
      }

      try {
        let text: string;
        try {
          text = await call(PRIMARY_MODEL);
        } catch (e) {
          if ((e as { code?: string }).code === "rl") text = await call(FALLBACK_MODEL);
          else throw e;
        }
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (!m) return { ok: false, error: "Briefing returned malformed output." };
          raw = JSON.parse(m[0]);
        }
        const parsed = ResultSchema.parse(raw);
        return { ok: true, result: parsed };
      } catch (e) {
        console.error("[generateDailyBriefing] failed", e);
        return { ok: false, error: "Briefing service temporarily unavailable." };
      }
    },
  );
