import { NextResponse } from "next/server";
import { ExploreResponse } from "@/lib/coach/schemas";
import { EXPLORE_SYSTEM } from "@/lib/coach/prompts";
import { coachJson } from "@/lib/coach/server";

export async function POST(req: Request) {
  try {
    const body = await req.json(); // {fenBefore, sanPlayed, cpLoss, explorerStats, openingName}
    const raw = await coachJson(EXPLORE_SYSTEM, body);
    return NextResponse.json(ExploreResponse.parse(JSON.parse(raw)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
