import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { createResponsesGateway } from "./ai-gateway.server";

const inputSchema = z.object({ reflection: z.string().min(60).max(12000) });
const outputSchema = z.object({
  prompts: z.array(z.string()),
  gentle_focus: z.string(),
});

export type FollowUpResult = {
  ok: true;
  prompts: string[];
  gentleFocus: string;
  source: "lovable-ai";
} | {
  ok: false;
  error: string;
};

function safeGatewayMessage(error: unknown) {
  const value = error as { statusCode?: number; responseBody?: string; message?: string };
  if (value.statusCode === 402) return "AI credits are currently unavailable. Your reflection is saved; add credits in workspace billing to continue.";
  if (value.statusCode === 401) return "AI journaling is not configured yet. Your reflection is still saved.";
  if (value.statusCode === 403) return "AI journaling is currently unavailable for this workspace. Your reflection is still saved.";
  if (value.statusCode === 429) return "AI journaling is resting after high demand. Please try again in a moment.";
  if (value.statusCode && value.statusCode >= 500) return "AI journaling is temporarily unavailable. Your reflection is still saved.";
  return "Sensus could not shape follow-up prompts right now. Your reflection is still saved.";
}

export const generateFollowUpPrompts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<FollowUpResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "AI journaling is not configured yet. Your reflection is still saved." };

    try {
      const lovable = createResponsesGateway(key);
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: outputSchema }),
        system: "You are Sensus, a grounded and compassionate reflection guide. Never diagnose or imply certainty. Generate exactly four concise, personalized follow-up journaling questions that deepen insight without becoming repetitive. Include one gentle focus sentence for the next reflection. Return the requested JSON structure only.",
        prompt: `Completed reflection:\n${data.reflection}\n\nCreate four distinct follow-up questions: one about emotion, one about an underlying need or belief, one about a different perspective, and one about a realistic next step.`,
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
      if (!output) return { ok: false, error: "Sensus completed the reflection but did not return any prompts. Please try again." };
      const prompts = output.prompts.map((prompt) => prompt.trim()).filter(Boolean).slice(0, 4);
      if (prompts.length === 0) return { ok: false, error: "Sensus completed the reflection but did not return any prompts. Please try again." };
      return { ok: true, prompts, gentleFocus: output.gentle_focus.trim(), source: "lovable-ai" };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = outputSchema.parse(JSON.parse(error.text));
          return { ok: true, prompts: parsed.prompts.slice(0, 4), gentleFocus: parsed.gentle_focus, source: "lovable-ai" };
        } catch { return { ok: false, error: "Sensus could not shape follow-up prompts right now. Your reflection is still saved." }; }
      }
      console.error("Follow-up prompt generation failed", error);
      return { ok: false, error: safeGatewayMessage(error) };
    }
  });