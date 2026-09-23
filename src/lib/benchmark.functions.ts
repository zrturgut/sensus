import { createServerFn } from "@tanstack/react-start";
import { Output, generateText } from "ai";
import { z } from "zod";
import { createResponsesGateway } from "./ai-gateway.server";
import { safeGatewayMessage } from "./gateway-errors";

const MODEL = "openai/gpt-6-astra";

const inputSchema = z.object({
  reflection: z.string().min(40).max(12000),
  goals: z.array(z.object({ id: z.string(), title: z.string(), category: z.string() })).max(40),
  plan: z.object({
    latencyMs: z.number(),
    blocks: z.array(
      z.object({
        title: z.string(),
        goalTitle: z.string(),
        startsAt: z.string(),
        durationMinutes: z.number(),
      }),
    ),
  }),
});

type NormalizedBlock = { title: string; goalTitle: string; dayKey: string; hour: number; minute: number; duration: number };

export type PlannerScore = {
  label: string;
  score: number;
  blocks: number;
  linkedToGoals: number;
  schedulable: number;
  daysCovered: number;
  recoveryBlocks: number;
  latencyMs: number;
};

export type BenchmarkResult =
  | { ok: true; baseline: PlannerScore; agentic: PlannerScore; verdict: string; measuredAt: string }
  | { ok: false; error: string };

const baselineSchema = z.object({
  blocks: z.array(
    z.object({
      title: z.string(),
      goal_title: z.string(),
      day_offset: z.number(),
      start_time: z.string(),
      duration_minutes: z.number(),
    }),
  ),
});

const RECOVERY = /rest|recover|offline|walk|sleep|break|shutdown|unplug|pause|breathe|evening off|no work/i;

/** Deterministic, code-side scoring so the comparison is measured rather than asserted. */
function scorePlan(label: string, blocks: NormalizedBlock[], goals: { title: string }[], latencyMs: number): PlannerScore {
  const count = blocks.length;
  const titles = goals.map((goal) => goal.title.toLowerCase());
  const words = (value: string) => value.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
  const linked = blocks.filter((block) => {
    const target = block.goalTitle.toLowerCase().trim();
    if (!target) return false;
    return titles.some((title) => {
      if (title === target) return true;
      const overlap = words(title).filter((word) => words(target).includes(word));
      return overlap.length >= 2;
    });
  }).length;
  const schedulable = blocks.filter(
    (block) => block.hour >= 5 && block.hour <= 22 && block.duration >= 15 && block.duration <= 120 && block.dayKey !== "",
  ).length;
  const days = new Set(blocks.map((block) => block.dayKey)).size;
  const recovery = blocks.filter((block) => RECOVERY.test(`${block.title} ${block.goalTitle}`)).length;
  const ratio = (value: number) => (count === 0 ? 0 : value / count);
  const spread = count === 0 ? 0 : Math.min(1, days / Math.min(5, count));
  const score = Math.round((ratio(linked) * 40 + ratio(schedulable) * 30 + spread * 20 + Math.min(1, recovery) * 10) * 100) / 100;
  return {
    label,
    score: Math.round(score * 100) / 100,
    blocks: count,
    linkedToGoals: linked,
    schedulable,
    daysCovered: days,
    recoveryBlocks: recovery,
    latencyMs,
  };
}

export const comparePlanners = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<BenchmarkResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "The comparison is not configured yet for this project." };
    if (data.plan.blocks.length === 0) return { ok: false, error: "Build a week first, then Sensus can measure it against the baseline." };

    const agenticBlocks: NormalizedBlock[] = data.plan.blocks.map((block) => {
      const when = new Date(block.startsAt);
      const valid = !Number.isNaN(when.getTime());
      return {
        title: block.title,
        goalTitle: block.goalTitle,
        dayKey: valid ? when.toDateString() : "",
        hour: valid ? when.getHours() : -1,
        minute: valid ? when.getMinutes() : 0,
        duration: block.durationMinutes,
      };
    });

    try {
      const lovable = createResponsesGateway(key);
      const startedAt = Date.now();
      const baseline = await generateText({
        model: lovable.responses(MODEL),
        output: Output.object({ schema: baselineSchema }),
        system:
          "You are a planning assistant. Read the reflection and return a plan of work blocks for the coming week as JSON only. You have no tools and no access to the person's tracked goals.",
        prompt: `Reflection:\n${data.reflection}`,
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
        },
      });
      const baselineOutput = baseline.output;
      const baselineLatency = Date.now() - startedAt;
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const baselineBlocks: NormalizedBlock[] = (baselineOutput?.blocks ?? []).slice(0, 14).map((block: z.infer<typeof baselineSchema>["blocks"][number]) => {
        const offset = Math.round(Number(block.day_offset));
        const [rawHour, rawMinute] = String(block.start_time).split(":");
        const hour = Number.parseInt(rawHour ?? "", 10);
        const minute = Number.parseInt(rawMinute ?? "0", 10) || 0;
        const valid = Number.isFinite(offset) && offset >= 1 && offset <= 7 && Number.isFinite(hour);
        const when = valid ? new Date(midnight.getTime() + offset * 86400000) : null;
        return {
          title: String(block.title),
          goalTitle: String(block.goal_title),
          dayKey: when ? when.toDateString() : "",
          hour: Number.isFinite(hour) ? hour : -1,
          minute,
          duration: Math.round(Number(block.duration_minutes)) || 0,
        };
      });

      const baselineScore = scorePlan("Single-shot baseline", baselineBlocks, data.goals, baselineLatency);
      const agenticScore = scorePlan("Sensus agentic planner", agenticBlocks, data.goals, data.plan.latencyMs);
      const delta = Math.round((agenticScore.score - baselineScore.score) * 10) / 10;
      const verdict =
        delta > 0
          ? `The agentic planner scored ${delta} points higher by grounding ${agenticScore.linkedToGoals} of ${agenticScore.blocks} blocks in goals you already track, against ${baselineScore.linkedToGoals} of ${baselineScore.blocks} for the single-shot baseline.`
          : delta === 0
            ? "Both planners scored the same on this reflection. The agentic run still links blocks to your tracked goals, which the baseline cannot see."
            : `The single-shot baseline scored ${Math.abs(delta)} points higher on this reflection. Sensus shows this honestly rather than hiding it.`;

      return { ok: true, baseline: baselineScore, agentic: agenticScore, verdict, measuredAt: new Date().toISOString() };
    } catch (error) {
      console.error("Planner comparison failed", error);
      return { ok: false, error: safeGatewayMessage(error, "The planner comparison") };
    }
  });
