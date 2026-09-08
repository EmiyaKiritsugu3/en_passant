import Anthropic from "@anthropic-ai/sdk";

export function getModel(): string {
  return process.env.COACH_MODEL || "claude-3-5-sonnet-20241022";
}

export async function coachJson(system: string, payload: unknown): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Offline local fallback when no Anthropic API key is configured
    return JSON.stringify({
      critique: "Excelente lance. Continue desenvolvendo suas peças e controlando o centro.",
      intent: "Desenvolver peças menores e preparar o roque com segurança.",
      tags: ["tactics", "pawns"],
      homework: "Revisar as casas centrais e coordenação das peças menores.",
      summary: "Partida disputada. Foco tático apurado e transição precisa.",
      result: "1-0",
      moments: [],
      takeaway: "Mantenha o cálculo apurado antes de cada avanço de peão.",
      profileDelta: {},
      verdict: "Lance sólido e alinhado aos princípios gerais da posição.",
      consequences: "Garante harmonia no tabuleiro e mantém o rei protegido.",
      namedVariant: "Linha Clássica de Desenvolvimento",
      reply: "Estou aqui para ajudar a calcular seus lances e aperfeiçoar seu plano de jogo.",
    });
  }

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

