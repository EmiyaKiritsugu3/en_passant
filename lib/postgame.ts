import { Chess } from "chess.js";
import { classifyMove, detectPhase, moveScore, type Phase } from "./chess/measure";
import type { Engine } from "./engine/engine";
import { fetchTablebase } from "./lichess/tablebase";

export async function bestMoveEndgameAware(
  fen: string,
  engine: Engine,
  depth = 14
) {
  const c = new Chess(fen);
  const pieces = c.board().flat().filter(Boolean).length;
  if (pieces <= 7) {
    const tb = await fetchTablebase(fen);
    if (tb?.bestUci) {
      return { best: tb.bestUci, source: "tablebase" as const, category: tb.category };
    }
  }
  const e = await engine.analyze(fen, depth);
  return { best: e.best, source: "engine" as const, category: null as string | null };
}

export interface Row {
  ply: number;
  san: string;
  cpLoss: number;
  label: string;
  phase: Phase;
  score: number;
  fen: string;
  best: string;
}

export async function collectEvals(pgn: string, engine: Engine): Promise<Row[]> {
  const game = new Chess();
  game.loadPgn(pgn);
  const replay = new Chess();
  const rows: Row[] = [];
  let prev = await engine.analyze(replay.fen(), 10);
  for (const move of game.history({ verbose: true })) {
    replay.move(move.san);
    const cur = await engine.analyze(replay.fen(), 10);
    const moverWhite = replay.turn() === "b"; // turn already flipped to opponent
    const cpLoss = Math.max(0, moverWhite ? prev.cp - cur.cp : cur.cp - prev.cp);
    const ply = replay.history().length;

    let best = prev.best;
    const pieces = replay.board().flat().filter(Boolean).length;
    if (pieces <= 7) {
      const tb = await fetchTablebase(replay.fen());
      if (tb?.bestUci) {
        best = tb.bestUci;
      }
    }

    rows.push({
      ply,
      san: move.san,
      cpLoss,
      label: classifyMove(cpLoss, false, false),
      phase: detectPhase(ply, replay),
      score: moveScore(cpLoss),
      fen: replay.fen(),
      best,
    });
    prev = cur;
  }
  return rows;
}
