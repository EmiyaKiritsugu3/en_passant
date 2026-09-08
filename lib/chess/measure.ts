import type { Chess } from "chess.js";

export type Label = "brilliant" | "solid" | "inaccurate" | "mistake" | "blunder";
export type Phase = "opening" | "middlegame" | "endgame";

export function classifyMove(cpLoss: number, wasSacrifice: boolean, evalKept: boolean): Label {
  if (wasSacrifice && evalKept) return "brilliant";
  if (cpLoss < 50) return "solid";
  if (cpLoss < 100) return "inaccurate";
  if (cpLoss < 200) return "mistake";
  return "blunder";
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function detectPhase(ply: number, chess: Chess): Phase {
  if (ply < 20) return "opening"; // moves 1-10, spec heuristic
  const board = chess.board().flat().filter(Boolean);
  const queens = board.filter((s) => s!.type === "q");
  if (queens.length === 0) return "endgame"; // queens traded
  const minorMajor = board
    .filter((s) => s!.type !== "p" && s!.type !== "k")
    .reduce((sum, s) => sum + VALUES[s!.type], 0);
  if (minorMajor <= 13) return "endgame"; // spec heuristic
  // ponytail: heuristic only; real phase detection later
  return "middlegame";
}

export function moveScore(cpLoss: number): number {
  return Math.round(100 * Math.exp(-Math.max(0, cpLoss) / 200));
}

export function phaseAverages(scored: { phase: Phase; score: number }[]): Record<Phase, number> {
  const out: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };
  for (const s of scored) out[s.phase].push(s.score);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  return { opening: avg(out.opening), middlegame: avg(out.middlegame), endgame: avg(out.endgame) };
}
