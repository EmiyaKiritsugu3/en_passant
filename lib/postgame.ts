import { Chess } from "chess.js";
import { classifyMove, detectPhase, moveScore, type Phase } from "./chess/measure";
import type { Engine } from "./engine/engine";

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
    rows.push({
      ply,
      san: move.san,
      cpLoss,
      label: classifyMove(cpLoss, false, false),
      phase: detectPhase(ply, replay),
      score: moveScore(cpLoss),
      fen: replay.fen(),
      best: prev.best,
    });
    prev = cur;
  }
  return rows;
}
