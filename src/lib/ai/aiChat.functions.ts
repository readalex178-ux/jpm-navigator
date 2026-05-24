import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

const MsgSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(40_000),
});

async function callGateway(
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  json: boolean,
  temperature: number,
): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) throw Object.assign(new Error("rate_limit"), { code: "rate_limit" });
  if (res.status === 402) throw Object.assign(new Error("credits"), { code: "credits" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`upstream ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        messages: z.array(MsgSchema).min(1).max(50),
        json: z.boolean().optional(),
        temperature: z.number().min(0).max(2).optional(),
        model: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; content: string } | { ok: false; code: string; error: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, code: "not_configured", error: "Lovable AI gateway not configured." };
    }
    const model = data.model ?? PRIMARY_MODEL;
    const json = data.json ?? false;
    const temperature = data.temperature ?? 0.7;
    try {
      const content = await callGateway(model, data.messages, apiKey, json, temperature);
      return { ok: true, content };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "rate_limit") {
        try {
          const content = await callGateway(FALLBACK_MODEL, data.messages, apiKey, json, temperature);
          return { ok: true, content };
        } catch (e2) {
          const code2 = (e2 as { code?: string }).code ?? "upstream";
          return { ok: false, code: code2, error: (e2 as Error).message };
        }
      }
      return { ok: false, code: code ?? "upstream", error: (e as Error).message };
    }
  });
