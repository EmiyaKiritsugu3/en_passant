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

interface RawExplorerData {
  moves?: ExplorerMove[];
  white?: number;
  draws?: number;
  black?: number;
  opening?: { eco?: string; name?: string };
}

const rawCache = new Map<string, RawExplorerData | null>();
const inFlight = new Map<string, Promise<RawExplorerData | null>>();

let cacheGeneration = 0;

export function clearCache(): void {
  cacheGeneration++;
  rawCache.clear();
  inFlight.clear();
}

async function fetchRaw(fen: string): Promise<RawExplorerData | null> {
  if (rawCache.has(fen)) return rawCache.get(fen)!;
  if (inFlight.has(fen)) return inFlight.get(fen)!;

  const currentGen = cacheGeneration;
  const promise = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`, {
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error("explorer " + res.status);
      const data = (await res.json()) as RawExplorerData;
      if (currentGen === cacheGeneration) {
        rawCache.set(fen, data);
      }
      return data;
    } catch {
      return null;
    } finally {
      if (currentGen === cacheGeneration) {
        inFlight.delete(fen);
      }
    }
  })();

  inFlight.set(fen, promise);
  return promise;
}

export async function fetchExplorerMoves(fen: string): Promise<ExplorerMove[]> {
  const data = await fetchRaw(fen);
  return (data?.moves ?? []) as ExplorerMove[];
}

export async function fetchExplorerStats(fen: string): Promise<ExplorerStats | null> {
  const data = await fetchRaw(fen);
  if (!data) return null;
  return {
    white: data.white ?? 0,
    draws: data.draws ?? 0,
    black: data.black ?? 0,
    opening: data.opening ? { eco: data.opening.eco ?? "", name: data.opening.name ?? "" } : undefined,
  };
}
