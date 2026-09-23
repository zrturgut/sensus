import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { createResponsesGateway } from "./ai-gateway.server";

const inputSchema = z.object({
  title: z.string().min(3).max(200),
  category: z.string().min(1).max(60),
  horizonWeeks: z.number().int().min(2).max(52).nullable(),
});

const outputSchema = z.object({
  dream: z.string(),
  internal_friction: z.string(),
  if_then_plan: z.string(),
  horizon_weeks: z.number(),
  weekly_commitment: z.string(),
  milestones: z.array(
    z.object({
      title: z.string(),
      outcome: z.string(),
      first_action: z.string(),
      due_in_days: z.number(),
    }),
  ),
});

export type RoadmapMilestone = {
  title: string;
  outcome: string;
  firstAction: string;
  dueDate: string;
  dueLabel: string;
};

export type ExecutionRoadmap = {
  dream: string;
  internal_friction: string;
  if_then_plan: string;
  horizonWeeks: number;
  weeklyCommitment: string;
  milestones: RoadmapMilestone[];
  source: "lovable-ai";
};

export type RoadmapResult = { ok: true; roadmap: ExecutionRoadmap } | { ok: false; error: string };

function safeGatewayMessage(error: unknown) {
  const value = error as { statusCode?: number };
  if (value.statusCode === 402) return "AI planning is paused because AI credits are unavailable. Add credits in workspace billing to generate roadmaps.";
  if (value.statusCode === 401) return "AI planning is not configured yet for this project.";
  if (value.statusCode === 403) return "AI planning is currently unavailable for this workspace.";
  if (value.statusCode === 429) return "AI planning is resting after high demand. Please try again in a moment.";
  if (value.statusCode && value.statusCode >= 500) return "AI planning is temporarily unavailable. Please try again shortly.";
  return "Sensus could not build the roadmap right now. Please try again.";
}

function shape(raw: z.infer<typeof outputSchema>): ExecutionRoadmap {
  const now = Date.now();
  const milestones = raw.milestones
    .map((milestone) => {
      const days = Math.max(1, Math.round(Number.isFinite(milestone.due_in_days) ? milestone.due_in_days : 7));
      const due = new Date(now + days * 24 * 60 * 60 * 1000);
      due.setHours(9, 0, 0, 0);
      return {
        title: milestone.title.trim(),
        outcome: milestone.outcome.trim(),
        firstAction: milestone.first_action.trim(),
        dueDate: due.toISOString(),
        dueLabel: due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      };
    })
    .filter((milestone) => milestone.title.length > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  return {
    dream: raw.dream.trim(),
    internal_friction: raw.internal_friction.trim(),
    if_then_plan: raw.if_then_plan.trim(),
    horizonWeeks: Math.max(2, Math.round(raw.horizon_weeks || 12)),
    weeklyCommitment: raw.weekly_commitment.trim(),
    milestones,
    source: "lovable-ai",
  };
}

export const generateExecutionRoadmap = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<RoadmapResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "AI planning is not configured yet for this project." };

    const horizon = data.horizonWeeks ?? 12;
    try {
      const lovable = createResponsesGateway(key);
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: outputSchema }),
        system:
          "You are Sensus, a grounded execution architect. You turn ambitions into realistic, sequenced plans using WOOP-style stress testing. Be concrete and specific to the stated goal: never generic filler. Milestones must be sequential, verifiable, and achievable by one person alongside ordinary life. due_in_days counts days from today and must increase across milestones, staying inside the horizon. Return only the requested JSON structure.",
        prompt: `Goal: ${data.title}\nCategory: ${data.category}\nHorizon: about ${horizon} weeks.\n\nProduce:\n- dream: a vivid, specific description of the achieved outcome (2 sentences).\n- internal_friction: the most likely internal obstacle for this particular goal (1-2 sentences).\n- if_then_plan: one concrete implementation intention in the form "If X happens, then I will Y".\n- horizon_weeks: the realistic horizon in weeks.\n- weekly_commitment: the honest weekly time and cadence this plan requires.\n- milestones: 4 to 6 sequential milestones, each with a short title, a verifiable outcome, a first_action that can be done in under 30 minutes, and due_in_days from today.`,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const output = await result.output;
      if (!output || output.milestones.length === 0) {
        return { ok: false, error: "Sensus did not return a usable roadmap. Please try again." };
      }
      return { ok: true, roadmap: shape(output) };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          if (!error.text) return { ok: false, error: safeGatewayMessage(error) };
          return { ok: true, roadmap: shape(outputSchema.parse(JSON.parse(error.text))) };
        } catch {
          return { ok: false, error: "Sensus could not build the roadmap right now. Please try again." };
        }
      }
      console.error("Execution roadmap generation failed", error);
      return { ok: false, error: safeGatewayMessage(error) };
    }
  });
