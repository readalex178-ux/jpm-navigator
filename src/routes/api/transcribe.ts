import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

async function verifyAuth(request: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  const token = authHeader.slice("Bearer ".length);
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Auth not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return { ok: true };
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await verifyAuth(request);
        if (!auth.ok) return auth.response;

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ ok: false, error: "ELEVENLABS_API_KEY is not configured." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        let incoming: FormData;
        try {
          incoming = await request.formData();
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "Expected multipart form-data." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const file = incoming.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return new Response(JSON.stringify({ ok: false, error: "Missing audio file." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Cap at ~25MB to keep request bounded.
        if (file.size > 25 * 1024 * 1024) {
          return new Response(JSON.stringify({ ok: false, error: "File too large (max 25MB)." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const body = new FormData();
        body.append("file", file);
        body.append("model_id", "scribe_v2");
        body.append("tag_audio_events", "false");
        body.append("diarize", "false");

        const upstream = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body,
        });
        if (!upstream.ok) {
          const txt = await upstream.text().catch(() => "");
          return new Response(
            JSON.stringify({ ok: false, error: `Transcription failed (${upstream.status}): ${txt.slice(0, 200)}` }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }
        const json = (await upstream.json()) as { text?: string };
        return new Response(JSON.stringify({ ok: true, text: json.text ?? "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
