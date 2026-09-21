export interface TBResult {
  category: string;
  bestUci: string | null;
}

export async function fetchTablebase(fen: string): Promise<TBResult | null> {
  try {
    const res = await fetch(`/api/lichess/tablebase?fen=${encodeURIComponent(fen)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const best =
      (data.moves ?? []).find((m: { uci?: string }) => Boolean(m.uci))?.uci ??
      null;
    return { category: data.category ?? "unknown", bestUci: best };
  } catch {
    return null; // fallback: deepen WASM search
  }
}
