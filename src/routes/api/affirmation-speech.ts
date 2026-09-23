import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const speechSchema = z.object({ text: z.string().trim().min(3).max(900) });
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export const Route = createFileRoute("/api/affirmation-speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = speechSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Add an affirmation to hear it aloud." }, { status: 400 });

        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return Response.json({ error: "Affirmation audio is not connected." }, { status: 503 });

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: parsed.data.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.62, similarity_boost: 0.76, style: 0.34, use_speaker_boost: true, speed: 0.92 },
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          console.error(`ElevenLabs affirmation speech failed [${response.status}]: ${detail}`);
          return Response.json({ error: detail || "Affirmation audio could not be created." }, { status: response.status });
        }
        return new Response(response.body, {
          status: response.status,
          headers: { "Content-Type": response.headers.get("content-type") ?? "audio/mpeg", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});