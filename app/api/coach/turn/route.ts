import { NextResponse } from "next/server";
import { TurnResponse } from "@/lib/coach/schemas";
import { TURN_SYSTEM } from "@/lib/coach/prompts";
import { coachJson } from "@/lib/coach/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const raw = await coachJson(TURN_SYSTEM, body);
    return NextResponse.json(TurnResponse.parse(JSON.parse(raw)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
