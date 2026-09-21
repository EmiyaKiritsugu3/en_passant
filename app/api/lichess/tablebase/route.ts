import { NextResponse } from "next/server";
import { fetchStandardTablebase } from "@/lib/lichess/upstream";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const fen = new URL(req.url).searchParams.get("fen");
  if (!fen) {
    return NextResponse.json({ error: "missing fen" }, { status: 400 });
  }
  const data = await fetchStandardTablebase(fen);
  if (!data) {
    return NextResponse.json({ error: "tablebase unavailable" }, { status: 502 });
  }
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
