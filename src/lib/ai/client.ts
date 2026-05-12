import type { Settings } from "../btf/types";
import { BTF_SYSTEM } from "./btfFramework";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Add your provider, model, and API key in Settings.");
  }
}

const baseFor = (s: Settings) => {
  if (s.baseUrl) return s.baseUrl.replace(/\/+$/, "");
  switch (s.aiProvider) {
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "lmstudio":
      return "http://localhost:1234/v1";
  }
};

export async function chat(
  settings: Settings,
  messages: ChatMsg[],
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  if (!settings.model) throw new AiNotConfiguredError();
  if (settings.aiProvider !== "lmstudio" && !settings.apiKey) throw new AiNotConfiguredError();

  const url = `${baseFor(settings)}/chat/completions`;
  const body: any = {
    model: settings.model,
    messages: [{ role: "system", content: BTF_SYSTEM }, ...messages],
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export async function chatJson<T = unknown>(settings: Settings, messages: ChatMsg[]): Promise<T> {
  const text = await chat(settings, messages, { json: true });
  try {
    return JSON.parse(text) as T;
  } catch {
    // try to extract first {...} block
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI did not return valid JSON");
  }
}
