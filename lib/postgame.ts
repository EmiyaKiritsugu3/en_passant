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
  fenBefore: string;
  fenAfter: string;
  best: string;
}

export async function collectEvals(pgn: string, engine: Engine): Promise<Row[]> {
  const game = new Chess();
  game.loadPgn(pgn);
  const replay = new Chess();
  const rows: Row[] = [];
  let prev = await engine.analyze(replay.fen(), 10);
  for (const move of game.history({ verbose: true })) {
    const fenBefore = replay.fen();
    let best = prev.best;
    const piecesBefore = replay.board().flat().filter(Boolean).length;
    if (piecesBefore <= 7) {
      const tb = await fetchTablebase(fenBefore);
      if (tb?.bestUci) {
        best = tb.bestUci;
      }
    }

    replay.move(move.san);
    const fenAfter = replay.fen();
    const cur = await engine.analyze(fenAfter, 10);

    // prev.cp is score before move (from mover's perspective)
    // cur.cp is score after move (from opponent's perspective)
    // Therefore, mover's score after move is -cur.cp
    // cpLoss = max(0, prev.cp - (-cur.cp)) = max(0, prev.cp + cur.cp)
    const cpLoss = Math.max(0, prev.cp + cur.cp);
    const ply = replay.history().length;

    rows.push({
      ply,
      san: move.san,
      cpLoss,
      label: classifyMove(cpLoss, false, false),
      phase: detectPhase(ply, replay),
      score: moveScore(cpLoss),
      fen: fenAfter,
      fenBefore,
      fenAfter,
      best,
    });
    prev = cur;
  }
  return rows;
}
