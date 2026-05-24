import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { BTF_ANALYZER_SYSTEM } from "./btfAnalyzerPrompt";
import { ThreadAnalysisSchema, type ThreadAnalysis } from "./analyzerSchema";

const InputSchema = z.object({
  thread: z.object({
    threadId: z.string(),
    participantName: z.string(),
    participantHeadline: z.string().optional(),
    participantProfileUrl: z.string().optional(),
    lastMessagePreview: z.string().optional(),
    messages: z
      .array(
        z.object({
          id: z.string(),
          sender: z.enum(["me", "them"]),
          text: z.string(),
          timestamp: z.string(),
        }),
      )
      .max(60),
    scrapedAt: z.string(),
  }),
  profile: z
    .object({
      profileUrl: z.string(),
      name: z.string(),
      headline: z.string().optional(),
      about: z.string().optional(),
      currentRole: z.string().optional(),
      location: z.string().optional(),
      recentActivity: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
  prospect: z
    .object({
      stage: z.string(),
      niche: z.string().optional(),
      tier: z.string().optional(),
      qualScore: z.number().optional(),
      daysSinceTouch: z.number().optional(),
    })
    .nullable()
    .optional(),
  setterName: z.string().optional(),
});

type AnalyzeOk = { ok: true; analysis: ThreadAnalysis };
type AnalyzeErr = { ok: false; error: string; code?: "rate_limit" | "credits" | "parse" | "config" | "upstream" };
export type AnalyzeResult = AnalyzeOk | AnalyzeErr;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

function buildUserPrompt(input: z.infer<typeof InputSchema>): string {
  const { thread, profile, prospect, setterName } = input;
  const profileBlock = profile
    ? `PROFILE
Name: ${profile.name}
Headline: ${profile.headline ?? "—"}
Current role: ${profile.currentRole ?? "—"}
Location: ${profile.location ?? "—"}
About: ${profile.about ?? "—"}
Recent activity: ${profile.recentActivity?.slice(0, 5).join(" | ") ?? "—"}`
    : `PROFILE: not yet scraped. Use only what's in the thread.`;

  const lastMsgs = thread.messages.slice(-15);
  const threadBlock = lastMsgs.length
    ? `THREAD with ${thread.participantName} (last ${lastMsgs.length} of ${thread.messages.length} msgs)
${lastMsgs
  .map(
    (m) =>
      `${m.sender === "me" ? "SETTER" : "PROSPECT"} (${m.timestamp}): ${m.text.slice(0, 600)}`,
  )
  .join("\n")}`
    : `THREAD with ${thread.participantName}: no messages yet (connected, awaiting first VN).`;

  const prospectBlock = prospect
    ? `LINKED PROSPECT: stage=${prospect.stage}, niche=${prospect.niche ?? "—"}, tier=${prospect.tier ?? "—"}, qualScore=${prospect.qualScore ?? "—"}, daysSinceTouch=${prospect.daysSinceTouch ?? "—"}`
    : `LINKED PROSPECT: none yet.`;

  return `${profileBlock}

${threadBlock}

${prospectBlock}

SETTER: ${setterName ?? "the setter"}

Analyze and return JSON only.`;
}

async function callGateway(model: string, userPrompt: string, apiKey: string): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: BTF_ANALYZER_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });

  if (res.status === 429) throw Object.assign(new Error("rate_limit"), { code: "rate_limit" });
  if (res.status === 402) throw Object.assign(new Error("credits"), { code: "credits" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`[linkedinAnalyzer] upstream ${res.status}: ${txt.slice(0, 500)}`);
    throw Object.assign(new Error("AI service temporarily unavailable."), {
      code: "upstream",
    });
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseAnalysis(text: string): ThreadAnalysis {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("parse");
    raw = JSON.parse(m[0]);
  }
  return ThreadAnalysisSchema.parse(raw);
}

export const analyzeThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "AI service is not configured.", code: "config" };
    }


    const userPrompt = buildUserPrompt(data);

    try {
      const text = await callGateway(PRIMARY_MODEL, userPrompt, apiKey);
      try {
        return { ok: true, analysis: parseAnalysis(text) };
      } catch {
        // one retry on bad JSON
        const text2 = await callGateway(PRIMARY_MODEL, userPrompt, apiKey);
        return { ok: true, analysis: parseAnalysis(text2) };
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "rate_limit") {
        try {
          const text = await callGateway(FALLBACK_MODEL, userPrompt, apiKey);
          return { ok: true, analysis: parseAnalysis(text) };
        } catch (e2) {
          const code2 = (e2 as { code?: string }).code;
          if (code2 === "rate_limit") {
            return { ok: false, error: "AI rate-limited. Try again in a moment.", code: "rate_limit" };
          }
          if (code2 === "credits") {
            return { ok: false, error: "Lovable AI credits exhausted. Add credits in Workspace settings.", code: "credits" };
          }
          return { ok: false, error: "AI service temporarily unavailable.", code: "upstream" };
        }
      }
      if (code === "credits") {
        return { ok: false, error: "Lovable AI credits exhausted. Add credits in Workspace settings.", code: "credits" };
      }
      if ((e as Error).message === "parse") {
        return { ok: false, error: "AI returned malformed output. Click Regenerate.", code: "parse" };
      }
      return { ok: false, error: "AI service temporarily unavailable.", code: "upstream" };
    }
  });
