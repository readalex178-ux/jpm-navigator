import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
