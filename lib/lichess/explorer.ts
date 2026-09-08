export interface ExplorerMove {
  san: string;
  white: number;
  draws: number;
  black: number;
}

export interface ExplorerStats {
  white: number;
  draws: number;
  black: number;
  opening?: { eco: string; name: string };
}

const cache = new Map<string, ExplorerMove[]>();
const statsCache = new Map<string, ExplorerStats | null>();

export function clearCache(): void {
  cache.clear();
  statsCache.clear();
}

export async function fetchExplorerMoves(fen: string): Promise<ExplorerMove[]> {
  if (cache.has(fen)) return cache.get(fen)!;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error("explorer " + res.status);
    const data = await res.json();
    const moves = (data.moves ?? []) as ExplorerMove[];
    cache.set(fen, moves);
    return moves;
  } catch {
    return [];
  }
}

export async function fetchExplorerStats(fen: string): Promise<ExplorerStats | null> {
  if (statsCache.has(fen)) return statsCache.get(fen)!;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error("explorer " + res.status);
    const data = await res.json();
    const stats: ExplorerStats = {
      white: data.white ?? 0,
      draws: data.draws ?? 0,
      black: data.black ?? 0,
      opening: data.opening ? { eco: data.opening.eco ?? "", name: data.opening.name ?? "" } : undefined,
    };
    statsCache.set(fen, stats);
    return stats;
  } catch {
    statsCache.set(fen, null);
    return null;
  }
}
