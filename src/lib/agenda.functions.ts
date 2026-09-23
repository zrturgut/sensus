import { createServerFn } from "@tanstack/react-start";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { createResponsesGateway } from "./ai-gateway.server";
import { safeGatewayMessage } from "./gateway-errors";

const MODEL = "openai/gpt-6-astra";

const inputSchema = z.object({
  reflection: z.string().min(40).max(12000),
  goals: z.array(z.object({ id: z.string(), title: z.string(), category: z.string() })),
});

export type AgendaBlock = {
  id: string;
  title: string;
  goalTitle: string;
  why: string;
  durationMinutes: number;
  startsAt: string;
  dayLabel: string;
  timeLabel: string;
  done?: boolean;
};

export type AgendaGoal = { title: string; category: string; existingGoalId: string | null };

export type PlanMeta = {
  model: string;
  toolCalls: number;
  goalsLinked: number;
  goalsCreated: number;
  blocksScheduled: number;
  latencyMs: number;
};

export type WeekPlan = {
  summary: string;
  goals: AgendaGoal[];
  blocks: AgendaBlock[];
  meta: PlanMeta;
  createdAt: string;
  source: "lovable-ai";
};

export type AgendaResult = { ok: true; plan: WeekPlan } | { ok: false; error: string };

const CATEGORIES = ["Career", "Fitness", "Mindset", "Creative"];

function normalizeCategory(value: string) {
  const match = CATEGORIES.find((item) => item.toLowerCase() === value.trim().toLowerCase());
  return match ?? "Mindset";
}

export const planWeekFromReflection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<AgendaResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "Week planning is not configured yet for this project." };

    const known = data.goals.slice(0, 40);
    const goals: AgendaGoal[] = [];
    const blocks: AgendaBlock[] = [];
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const startedAt = Date.now();
    let toolCalls = 0;

    try {
      const lovable = createResponsesGateway(key);
      const result = streamText({
        model: lovable.responses(MODEL),
        stopWhen: stepCountIs(50),
        tools: {
          list_existing_goals: tool({
            description: "List the goals the person already tracks in Sensus, with their ids and categories.",
            inputSchema: z.object({}),
            execute: async () => ({
              toolCalls: ++toolCalls,
              goals: known.length > 0 ? known : [{ id: "none", title: "No goals tracked yet", category: "none" }],
            }),
          }),
          add_goal: tool({
            description:
              "Add an intention to the person's programme. Use existing_goal_id when the reflection clearly continues a goal that already exists, otherwise pass null to create a new one.",
            inputSchema: z.object({
              title: z.string().describe("Short, first-person intention, under 60 characters."),
              category: z.string().describe("One of Career, Fitness, Mindset, Creative."),
              existing_goal_id: z.string().nullable().describe("Id from list_existing_goals, or null for a new goal."),
            }),
            execute: async ({ title, category, existing_goal_id }) => {
              const trimmed = title.trim();
              if (!trimmed) return { ok: false, reason: "empty title" };
              const existing = known.find((goal) => goal.id === existing_goal_id) ?? null;
              if (goals.length >= 6) return { ok: false, reason: "goal limit reached" };
              goals.push({ title: trimmed.slice(0, 120), category: normalizeCategory(category), existingGoalId: existing?.id ?? null });
              return { ok: true, tracked: goals.length };
            },
          }),
          schedule_block: tool({
            description:
              "Place one concrete work block on the person's agenda for the coming week. Call once per block, spread across different days.",
            inputSchema: z.object({
              title: z.string().describe("What happens in this block, under 70 characters."),
              goal_title: z.string().describe("The intention this block serves."),
              why: z.string().describe("One short sentence on why this block matters now."),
              day_offset: z.number().describe("Days from today, 1 to 7."),
              start_time: z.string().describe("Local 24h start time such as 07:30 or 19:00."),
              duration_minutes: z.number().describe("Realistic length, 15 to 120."),
            }),
            execute: async ({ title, goal_title, why, day_offset, start_time, duration_minutes }) => {
              if (blocks.length >= 12) return { ok: false, reason: "agenda is full" };
              const offset = Math.min(7, Math.max(1, Math.round(Number.isFinite(day_offset) ? day_offset : 1)));
              const [rawHour, rawMinute] = start_time.split(":");
              const hour = Math.min(22, Math.max(5, Number.parseInt(rawHour ?? "9", 10) || 9));
              const minute = (Number.parseInt(rawMinute ?? "0", 10) || 0) >= 30 ? 30 : 0;
              const startsAt = new Date(midnight.getTime() + offset * 24 * 60 * 60 * 1000);
              startsAt.setHours(hour, minute, 0, 0);
              const duration = Math.min(120, Math.max(15, Math.round(Number.isFinite(duration_minutes) ? duration_minutes : 30)));
              blocks.push({
                id: crypto.randomUUID(),
                title: title.trim().slice(0, 120),
                goalTitle: goal_title.trim().slice(0, 120),
                why: why.trim().slice(0, 240),
                durationMinutes: duration,
                startsAt: startsAt.toISOString(),
                dayLabel: startsAt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
                timeLabel: startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
              });
              return { ok: true, scheduled: blocks.length };
            },
          }),
        },
        system:
          "You are Sensus, a grounded execution agent. You read a person's spoken daily reflection, notice what they want to do next week, and turn it into their programme and agenda. Work in steps: first call list_existing_goals, then call add_goal for each intention you find in the reflection (link it to an existing goal when it clearly continues one), then call schedule_block between four and eight times to place concrete blocks across different days of the coming week. Respect the energy and constraints the person describes: do not overfill their week, keep blocks short and realistic, and include at least one recovery or grounding block when the reflection sounds depleted. Never invent commitments the person did not mention or clearly imply. When every tool call is done, reply with two or three plain sentences summarising the week you built and the single most important block. No markdown, no lists, no headings.",
        prompt: `Today is ${midnight.toDateString()}.\n\nReflection:\n${data.reflection}`,
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

      const summary = (await result.text).trim();
      if (blocks.length === 0) {
        return { ok: false, error: "Sensus could not find enough about next week in this reflection. Mention what you want to do or change, then plan again." };
      }
      blocks.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      return {
        ok: true,
        plan: {
          summary: summary || "Your week is mapped into short, realistic blocks.",
          goals,
          blocks,
          createdAt: new Date().toISOString(),
          source: "lovable-ai",
        },
      };
    } catch (error) {
      console.error("Week planning failed", error);
      return { ok: false, error: safeGatewayMessage(error) };
    }
  });
