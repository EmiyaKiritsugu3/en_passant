import { NextResponse } from "next/server";
import { ChatMessage, ChatResponse } from "@/lib/coach/schemas";
import { CHAT_SYSTEM } from "@/lib/coach/prompts";
import { coachJson } from "@/lib/coach/server";
import { z } from "zod";

const ChatRequest = z.object({
  history: z.array(ChatMessage).max(12),
  fen: z.string(),
  pgn: z.string(),
  phase: z.string(),
  profile: z.unknown(),
  lastEval: z.unknown(),
});

export async function POST(req: Request) {
  try {
    const body = ChatRequest.parse(await req.json());
    const raw = await coachJson(CHAT_SYSTEM, body);
    // coach speaks markdown here, not JSON: wrap raw text in envelope
    return NextResponse.json(ChatResponse.parse({ reply: raw }));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
