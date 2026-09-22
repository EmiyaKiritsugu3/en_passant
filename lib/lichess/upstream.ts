export interface MastersExplorerData {
  moves?: Array<{ san: string; white: number; draws: number; black: number }>;
  white?: number;
  draws?: number;
  black?: number;
  opening?: { eco?: string; name?: string };
}

export interface StandardTablebaseData {
  category?: string;
  moves?: Array<{ uci?: string }>;
}

interface CacheEntry {
  exp: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

let generation = 0;

export function clearUpstreamCache(): void {
  generation++;
  cache.clear();
  inFlight.clear();
}

async function fetchJson(url: string, timeoutMs: number, headers?: HeadersInit): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, headers });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

// Opening explorer now requires a Lichess OAuth token server-side.
// Without LICHESS_EXPLORER_TOKEN upstream 401s and callers get null
// (clients fall back to offline data). Tablebase stays open.
function explorerHeaders(): HeadersInit | undefined {
  const token = process.env.LICHESS_EXPLORER_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T | null>): Promise<T | null> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now) return Promise.resolve(hit.data as T);
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T | null>;

  const gen = generation;
  const promise = (async () => {
    try {
      const data = await fn();
      if (data !== null && gen === generation) {
        cache.set(key, { exp: Date.now() + ttlMs, data });
      }
      return data;
    } finally {
      if (gen === generation) inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

export const MASTERS_TTL_MS = 3_600_000;
export const TABLEBASE_TTL_MS = 86_400_000;

export function fetchMastersExplorer(fen: string): Promise<MastersExplorerData | null> {
  return cached(`masters:${fen}`, MASTERS_TTL_MS, () =>
    fetchJson(
      `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`,
      6000,
      explorerHeaders()
    ).then((d) => (d === null ? null : (d as MastersExplorerData)))
  );
}

export function fetchStandardTablebase(fen: string): Promise<StandardTablebaseData | null> {
  return cached(`tb:${fen}`, TABLEBASE_TTL_MS, () =>
    fetchJson(
      `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`,
      6000
    ).then((d) => (d === null ? null : (d as StandardTablebaseData)))
  );
}
