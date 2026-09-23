import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  subject: z.string().min(3).max(300),
  category: z.string().max(60).optional(),
});

const buildPrompt = (subject: string, category?: string) =>
  `Create a cinematic vision-board artwork representing this aspiration: "${subject}". Category: ${category ?? "personal growth"}. Serene editorial photography, luminous natural light, elegant minimal composition, atmospheric depth, realistic materials, contemplative mood, high detail, no words, no letters, no logos, no watermark.`;

async function generateWithNebius(prompt: string): Promise<string | null> {
  const apiKey = process.env["NEBIUS_API_KEY"];
  if (!apiKey) return null;
  try {
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
      return null;
    }
    const payload = (await upstream.json()) as { data?: Array<{ url?: string | null }> };
    return payload.data?.[0]?.url ?? null;
  } catch (error) {
    console.error("Nebius image request error:", error);
    return null;
  }
}

// Lovable AI image generation (openai format, streamed so long generations stay alive).
// Reads the SSE stream to completion and returns the final image as a data URL.
async function generateWithLovable(prompt: string): Promise<string | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  try {
    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2.5-sunburst",
        prompt,
        stream: true,
        partial_images: 1,
      }),
    });
    if (!upstream.ok || !upstream.body) {
      console.error(`Lovable image request failed [${upstream.status}]: ${await upstream.text().catch(() => "")}`);
      return null;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalImage: string | null = null;
    let streamError: string | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const rawEvent of events) {
        const dataLines = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim());
        if (dataLines.length === 0) continue;
        const data = dataLines.join("\n");
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as {
            type?: string;
            b64_json?: string;
            error?: { message?: string };
          };
          if (parsed.type === "error" || parsed.error) {
            streamError = parsed.error?.message ?? "Image generation failed.";
          } else if (parsed.type === "image_generation.completed" && parsed.b64_json) {
            finalImage = parsed.b64_json;
          }
        } catch {
          // ignore heartbeat comments and malformed frames
        }
      }
    }
    if (streamError) {
      console.error("Lovable image stream error:", streamError);
      return null;
    }
    return finalImage ? `data:image/png;base64,${finalImage}` : null;
  } catch (error) {
    console.error("Lovable image request error:", error);
    return null;
  }
}

export const Route = createFileRoute("/api/generate-vision-art")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Add a clear intention before creating art." }, { status: 400 });

        const prompt = buildPrompt(parsed.data.subject, parsed.data.category);
        const url = (await generateWithNebius(prompt)) ?? (await generateWithLovable(prompt));
        if (!url) {
          return Response.json({ error: "Vision Art could not be created. Your curated image is still in place." }, { status: 502 });
        }
        return Response.json({ url, prompt });
      },
    },
  },
});
