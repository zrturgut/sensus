import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type StressBand = "Steady" | "Strained" | "Depleted";

export type ClarityResult = {
  is_sufficient: true;
  detected_distortion: string;
  reframe: string;
  blind_spot_insight: string;
  action_items: string[];
  stress_band: StressBand;
  emotional_tags: string[];
  grounding_micro_habit: string;
  source: "nebius" | "demo";
};

export type InsufficientClarityResult = {
  is_sufficient: false;
  guidance_message: string;
  source: "nebius" | "demo";
};

const inputSchema = z.object({ text: z.string().min(1).max(12000) });

const BAND_RUBRIC =
  "stress_band must be exactly one of: Steady (pressure is real but resources still match demand), Strained (demand exceeds resources and recovery is being skipped), Depleted (energy, sleep, or motivation is already spent). Choose the band from evidence in the text, never from tone alone.";

function clarityFallback(text: string): ClarityResult {
  const burnout = /tired|exhaust|burnout|sleep|morning/i.test(text);
  return {
    is_sufficient: true,
    detected_distortion: burnout ? "All-or-nothing thinking" : "Catastrophizing + mind reading",
    reframe: burnout
      ? "Low energy is information, not a character verdict. Protect the smallest repeatable action and let consistency rebuild capacity."
      : "You are treating uncertainty as evidence of inadequacy. The workload is real, but it does not prove you are failing or that others see you that way.",
    blind_spot_insight: burnout
      ? "You may be designing your week for your ideal energy instead of the energy you reliably have."
      : "Over-preparing may feel responsible, while quietly protecting you from the discomfort of showing unfinished work.",
    action_items: burnout
      ? ["Choose one must-do outcome for today", "Take a ten-minute daylight walk", "Set a shutdown alarm for tonight"]
      : ["Define the smallest shippable version", "Ask one colleague for a reality check", "Block 25 focused minutes before checking messages"],
    stress_band: burnout ? "Depleted" : "Strained",
    emotional_tags: burnout ? ["depleted", "frustrated", "hopeful"] : ["overwhelmed", "self-doubt", "driven"],
    grounding_micro_habit: "Exhale longer than you inhale for six slow breaths, then name one thing you can control in the next ten minutes.",
    source: "demo",
  };
}

async function requestNebius(prompt: string, system: string): Promise<unknown> {
  const key = process.env["NEBIUS_API_KEY"];
  if (!key) return null;
  const response = await fetch("https://api.tokenfactory.nebius.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "zai-org/GLM-5.3-Flash",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    console.error(`Nebius request failed [${response.status}]: ${await response.text()}`);
    return null;
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

export const analyzeSensusInput = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<ClarityResult | InsufficientClarityResult> => {
    const insufficient = z.object({ is_sufficient: z.literal(false), guidance_message: z.string().min(1) });
    const sufficient = z.object({
      is_sufficient: z.literal(true),
      detected_distortion: z.string().transform((v) => v.slice(0, 80)),
      reframe: z.string(),
      blind_spot_insight: z.string(),
      action_items: z.array(z.string()).min(2).max(5),
      stress_band: z.enum(["Steady", "Strained", "Depleted"]),
      emotional_tags: z.array(z.string()).min(1).max(5),
      grounding_micro_habit: z.string(),
    });
    const words = data.text.trim().split(/\s+/).filter(Boolean).length;
    const normalized = data.text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const personalSignals = /\b(i|im|ive|my|me|feel|felt|worried|stuck|tense|heavy|today|because|when|week)\b/i.test(normalized);
    const trivialSignals = /^(\s*(hello|hi|hey|test|testing|checking|just|123)\s*)+$/i.test(normalized);
    const guidance = "Say a bit more so Sensus doesn't guess — what happened, and what it is costing you right now.";
    if (data.text.trim().length < 60 || words < 15 || trivialSignals || !personalSignals) {
      return { is_sufficient: false, guidance_message: guidance, source: "demo" };
    }
    const raw = await requestNebius(
      `Evaluate and, only when sufficient, analyze this reflection: ${data.text}\nReturn one JSON object. When sufficient include is_sufficient: true and keys: detected_distortion, reframe, blind_spot_insight, action_items (2-4 concrete steps for the next 48 hours), stress_band, emotional_tags, grounding_micro_habit.`,
      `You are a grounded cognitive coach for founders and professionals. Return valid JSON only. Avoid diagnosis, clinical certainty, and vague inspiration. ${BAND_RUBRIC} First judge whether the input carries enough real personal context to analyze; if it is trivial, a greeting, or test text, return only {"is_sufficient":false,"guidance_message":"${guidance}"}.`,
    );
    const insufficientParsed = insufficient.safeParse(raw);
    if (insufficientParsed.success) return { ...insufficientParsed.data, source: "nebius" };
    const parsed = sufficient.safeParse(raw);
    if (!parsed.success && raw) console.error("Nebius clarity schema mismatch:", JSON.stringify(parsed.error.issues.slice(0, 6)));
    return parsed.success ? { ...parsed.data, source: "nebius" } : clarityFallback(data.text);
  });
