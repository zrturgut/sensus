export function safeGatewayMessage(error: unknown, subject = "This feature") {
  const status = (error as { statusCode?: number }).statusCode;
  if (status === 402) return `${subject} is paused because AI credits are unavailable. Add credits in workspace billing to continue.`;
  if (status === 401) return `${subject} is not configured yet for this project.`;
  if (status === 403) return `${subject} is currently unavailable for this workspace.`;
  if (status === 429) return `${subject} is resting after high demand. Please try again in a moment.`;
  if (status && status >= 500) return `${subject} is temporarily unavailable. Please try again shortly.`;
  return `${subject} could not complete right now. Please try again.`;
}
