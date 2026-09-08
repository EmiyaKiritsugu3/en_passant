export interface TBResult {
  category: string;
  bestUci: string | null;
}

export async function fetchTablebase(fen: string): Promise<TBResult | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
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
