import { createFileRoute } from "@tanstack/react-router";

const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > MAX_AUDIO_BYTES) return Response.json({ error: "Recording is too large." }, { status: 413 });
        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size < 2048 || audio.size > MAX_AUDIO_BYTES || !audio.type.startsWith("audio/")) {
          return Response.json({ error: "Record a little longer and try again." }, { status: 400 });
        }
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return Response.json({ error: "ElevenLabs is not connected." }, { status: 503 });
        const upstream = new FormData();
        upstream.append("file", audio, audio.name);
        upstream.append("model_id", "scribe_v2");
        upstream.append("tag_audio_events", "true");
        upstream.append("diarize", "false");
        const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST", headers: { "xi-api-key": key }, body: upstream,
        });
        if (!response.ok) {
          const detail = await response.text();
          console.error(`ElevenLabs transcription failed [${response.status}]: ${detail}`);
          return Response.json({ error: detail || "Transcription failed." }, { status: response.status });
        }
        const result = (await response.json()) as { text?: string };
        return Response.json({ text: result.text ?? "" });
      },
    },
  },
});
