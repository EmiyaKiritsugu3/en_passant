import { NextResponse } from "next/server";
import { PostgameResponse } from "@/lib/coach/schemas";
import { POSTGAME_SYSTEM } from "@/lib/coach/prompts";
import { coachJson } from "@/lib/coach/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const raw = await coachJson(POSTGAME_SYSTEM, body);
    return NextResponse.json(PostgameResponse.parse(JSON.parse(raw)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
