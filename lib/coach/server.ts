import Anthropic from "@anthropic-ai/sdk";

export function getModel(): string {
  const m = process.env.COACH_MODEL;
  if (!m) throw new Error("COACH_MODEL env is required (e.g. current claude-sonnet id)");
  return m;
}

export async function coachJson(system: string, payload: unknown): Promise<string> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: getModel(),
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("empty coach reply");
  return block.text;
}
