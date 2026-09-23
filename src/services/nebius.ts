import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ClarityResult = {
  detected_distortion: string;
  reframe: string;
  blind_spot_insight: string;
  action_items: string[];
  stress_level: number;
  emotional_tags: string[];
  grounding_micro_habit: string;
  source: "nebius" | "demo";
};

export type GoalResult = {
  dream: string;
  internal_friction: string;
  if_then_plan: string;
  source: "nebius" | "demo";
};

const inputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("clarity"), text: z.string().min(20).max(12000) }),
  z.object({ kind: z.literal("goal"), title: z.string().min(3).max(160), category: z.string().max(40) }),
]);

function clarityFallback(text: string): ClarityResult {
  const burnout = /tired|exhaust|burnout|sleep|morning/i.test(text);
  return {
    detected_distortion: burnout ? "All-or-nothing thinking" : "Catastrophizing + mind reading",
    reframe: burnout
      ? "Low energy is information, not a character verdict. Protect the smallest repeatable action and let consistency rebuild capacity."
      : "You are treating uncertainty as evidence of inadequacy. The workload is real, but it does not prove you are failing or that others see you that way.",
    blind_spot_insight: burnout
      ? "You may be designing your routine for your ideal energy instead of the energy you reliably have."
      : "Over-preparing may feel responsible, while quietly protecting you from the discomfort of showing unfinished work.",
    action_items: burnout
      ? ["Choose one must-do outcome for today", "Take a ten-minute daylight walk", "Set a shutdown alarm for tonight"]
      : ["Define the smallest shippable version", "Ask one colleague for a reality check", "Block 25 focused minutes before checking messages"],
    stress_level: burnout ? 7 : 8,
    emotional_tags: burnout ? ["depleted", "frustrated", "hopeful"] : ["overwhelmed", "self-doubt", "driven"],
    grounding_micro_habit: "Exhale longer than you inhale for six slow breaths, then name one thing you can control in the next ten minutes.",
    source: "demo",
  };
}

function goalFallback(title: string): GoalResult {
  return {
    dream: `Picture ${title.toLowerCase()} becoming part of your ordinary week—not a burst of motivation, but proof that you keep promises to yourself.`,
    internal_friction: "The real obstacle is likely negotiating with discomfort in the moment, then waiting for a more motivated version of you to take over.",
    if_then_plan: `If I notice myself postponing ${title.toLowerCase()}, then I will start a ten-minute minimum version before making another decision.`,
    source: "demo",
  };
}

async function requestNebius(prompt: string): Promise<unknown> {
  const key = process.env["NEBIUS_API_KEY"];
  if (!key) return null;
  const response = await fetch("https://api.tokenfactory.nebius.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "meta-llama/Llama-3.3-70B-Instruct",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a grounded cognitive coach. Return valid JSON only. Avoid diagnosis, certainty, and vague inspiration." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(`Nebius request failed [${response.status}]: ${detail}`);
    return null;
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

export const analyzeSensusInput = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.kind === "clarity") {
      const schema = z.object({
        detected_distortion: z.string(), reframe: z.string(), blind_spot_insight: z.string(),
        action_items: z.array(z.string()).min(2).max(5), stress_level: z.number().min(1).max(10),
        emotional_tags: z.array(z.string()).min(1).max(5), grounding_micro_habit: z.string(),
      });
      const raw = await requestNebius(`Analyze this reflection: ${data.text}\nReturn keys: detected_distortion, reframe, blind_spot_insight, action_items, stress_level, emotional_tags, grounding_micro_habit.`);
      const parsed = schema.safeParse(raw);
      return parsed.success ? { ...parsed.data, source: "nebius" as const } : clarityFallback(data.text);
    }
    const schema = z.object({ dream: z.string(), internal_friction: z.string(), if_then_plan: z.string() });
    const raw = await requestNebius(`Stress-test this ${data.category} goal using mental contrasting: ${data.title}. Return keys: dream, internal_friction, if_then_plan.`);
    const parsed = schema.safeParse(raw);
    return parsed.success ? { ...parsed.data, source: "nebius" as const } : goalFallback(data.title);
  });
