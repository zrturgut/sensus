import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  subject: z.string().min(3).max(300),
  category: z.string().max(60).optional(),
});

export const Route = createFileRoute("/api/generate-vision-art")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Add a clear intention before creating art." }, { status: 400 });
        const apiKey = process.env["NEBIUS_API_KEY"];
        if (!apiKey) return Response.json({ error: "Vision Art is using the curated fallback while image generation is unavailable." }, { status: 503 });

        const prompt = `Create a cinematic vision-board artwork representing this aspiration: "${parsed.data.subject}". Category: ${parsed.data.category ?? "personal growth"}. Serene editorial photography, luminous natural light, elegant minimal composition, atmospheric depth, realistic materials, contemplative mood, high detail, no words, no letters, no logos, no watermark.`;
        const upstream = await fetch("https://api.tokenfactory.nebius.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "black-forest-labs/flux-schnell",
            prompt,
            width: 1024,
            height: 1024,
            num_inference_steps: 4,
            seed: -1,
            response_format: "url",
            response_extension: "webp",
          }),
        });
        if (!upstream.ok) {
          console.error(`Nebius image request failed [${upstream.status}]: ${await upstream.text()}`);
          return Response.json({ error: "Vision Art could not be created. Your curated image is still in place." }, { status: upstream.status });
        }
        const payload = await upstream.json() as { data?: Array<{ url?: string | null }> };
        const url = payload.data?.[0]?.url;
        if (!url) return Response.json({ error: "Vision Art returned no image. Your curated image is still in place." }, { status: 502 });
        return Response.json({ url, prompt });
      },
    },
  },
});