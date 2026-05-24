import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const ROUTES = [
  "/",
  "/inbox",
  "/prospects",
  "/pipeline",
  "/outreach",
  "/linkedin",
  "/kpi",
  "/tools",
  "/training",
  "/settings",
] as const;

export const VoiceIntentSchema = z.object({
  kind: z.enum(["navigate", "prospect_action", "dictate", "unknown"]),
  // navigate
  route: z.string().optional(),
  // prospect_action
  prospectName: z.string().optional(),
  action: z
    .enum(["move_stage", "add_note", "log_activity", "set_tier", "open"])
    .optional(),
  stage: z
    .enum(["Found", "Cold", "Connected", "Replied", "VN1", "VN2", "Booked", "Lost"])
    .optional(),
  tier: z.enum(["DIY", "DWY", "DFY"]).optional(),
  activityType: z.enum(["VN", "text", "comment", "call", "note"]).optional(),
  text: z.string().optional(),
  // dictate
  transcript: z.string().optional(),
  // confirmation phrase shown to user
  confirm: z.string().max(160).default(""),
});
export type VoiceIntent = z.infer<typeof VoiceIntentSchema>;

const SYS = `You convert a BTF Setter's voice command into a JSON intent.

Routes available: ${ROUTES.join(", ")}
Stages: Found, Cold, Connected, Replied, VN1, VN2, Booked, Lost
Tiers: DIY, DWY, DFY
Activity types: VN, text, comment, call, note

Return ONLY JSON in this exact shape (no markdown):
{
  "kind": "navigate" | "prospect_action" | "dictate" | "unknown",
  "route": "<one of the routes if kind=navigate>",
  "prospectName": "<name if kind=prospect_action>",
  "action": "move_stage" | "add_note" | "log_activity" | "set_tier" | "open",
  "stage": "<stage if action=move_stage>",
  "tier": "<tier if action=set_tier>",
  "activityType": "<type if action=log_activity>",
  "text": "<note/activity text>",
  "transcript": "<raw text if kind=dictate>",
  "confirm": "<one-line plain-English summary of what you understood>"
}

Rules:
- "go to prospects" / "open the pipeline" / "show my KPIs" → navigate
- "open John Smith" / "show me Sarah" → prospect_action + action=open
- "move John to Booked" / "mark Sarah as VN1" → prospect_action + action=move_stage
- "add a note on John saying he wants the DFY package" → prospect_action + action=add_note + text
- "log a voice note to Sarah saying I sent the calendar link" → prospect_action + action=log_activity + activityType=VN + text
- "set John to DFY tier" → prospect_action + action=set_tier + tier=DFY
- Anything else (long-form writing, message drafting, anything ambiguous) → dictate with the raw transcript in "transcript"
- Always populate "confirm" with what you understood.`;

export const parseVoiceIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ transcript: z.string().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; intent: VoiceIntent } | { ok: false; error: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "AI gateway not configured." };
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYS },
            { role: "user", content: data.transcript },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });
      if (!res.ok) return { ok: false, error: `AI gateway ${res.status}` };
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content?.trim() ?? "";
      let raw: unknown;
      try {
        raw = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (!m) return { ok: false, error: "Malformed AI output." };
        raw = JSON.parse(m[0]);
      }
      const intent = VoiceIntentSchema.parse(raw);
      // Ensure raw transcript is preserved for dictate fallback.
      if (intent.kind === "dictate" && !intent.transcript) intent.transcript = data.transcript;
      return { ok: true, intent };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
