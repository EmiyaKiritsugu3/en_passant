export interface Profile {
  version: 1; rating: number; games: number;
  errorTags: Record<"tactics" | "kingSafety" | "endgame" | "pawns", number>;
  recentErrorFens: string[]; openings: Record<string, number>;
  phaseHistory: { game: number; opening: number; middlegame: number; endgame: number }[];
  streak: { count: number; lastDay: string };
}

export interface PostgameResult {
  won: boolean; tags: (keyof Profile["errorTags"])[]; fens: string[];
  phases: { opening: number; middlegame: number; endgame: number };
}

/** Local-day key YYYY-MM-DD (streak dances to the user's calendar, not UTC). */
export function todayKey(d = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftKey(key: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Date normaliza entradas como 30/02 em vez de invalidar: rejeita o
  // deslocamento se a construção não reproduzir os componentes de origem.
  if (Number.isNaN(d.getTime()) || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  d.setDate(d.getDate() + deltaDays);
  return todayKey(d);
}

/** Duolingo-style daily streak: same day = keep, next day = +1, gap = reset to 1. */
export function touchStreak(p: Profile, today = todayKey()): Profile {
  const next: Profile = structuredClone(p);
  if (next.streak.lastDay === today) return next;
  next.streak.count = next.streak.lastDay === shiftKey(today, -1) ? next.streak.count + 1 : 1;
  next.streak.lastDay = today;
  return next;
}

export function streakLabel(count: number): string {
  return count === 1 ? "1 dia seguido" : `${count} dias seguidos`;
}

/** Pílula só aparece com streak vigente (hoje ou ontem); evita exibir streak expirado. */
export function isStreakActive(lastDay: string, today = todayKey()): boolean {
  return lastDay === today || lastDay === shiftKey(today, -1);
}

export function applyPostgame(p: Profile, r: PostgameResult, today = todayKey()): Profile {
  const next: Profile = structuredClone(p);
  next.games += 1;
  next.rating += r.won ? 12 : r.tags.length === 0 ? 4 : -4; // simple K, draw-ish on clean loss
  for (const t of r.tags) next.errorTags[t] += 1;
  next.recentErrorFens = [...r.fens, ...next.recentErrorFens].slice(0, 50);
  next.phaseHistory.push({ game: next.games, ...r.phases });
  return touchStreak(next, today);
}
