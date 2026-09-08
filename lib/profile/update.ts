export interface Profile {
  version: 1; rating: number; games: number;
  errorTags: Record<"tactics" | "kingSafety" | "endgame" | "pawns", number>;
  recentErrorFens: string[]; openings: Record<string, number>;
  phaseHistory: { game: number; opening: number; middlegame: number; endgame: number }[];
}

export interface PostgameResult {
  won: boolean; tags: (keyof Profile["errorTags"])[]; fens: string[];
  phases: { opening: number; middlegame: number; endgame: number };
}

export function applyPostgame(p: Profile, r: PostgameResult): Profile {
  const next: Profile = structuredClone(p);
  next.games += 1;
  next.rating += r.won ? 12 : r.tags.length === 0 ? 4 : -4; // simple K, draw-ish on clean loss
  for (const t of r.tags) next.errorTags[t] += 1;
  next.recentErrorFens = [...r.fens, ...next.recentErrorFens].slice(0, 50);
  next.phaseHistory.push({ game: next.games, ...r.phases });
  return next;
}
