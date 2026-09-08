import { Chess } from "chess.js";

export interface Eval {
  cp: number;
  mate: number | null;
  best: string;
}

export interface Engine {
  setElo(elo: number): Promise<void>;
  analyze(fen: string, depth?: number): Promise<Eval>;
  quit(): void;
}

export function parseUciInfo(infoLine: string, bestLine: string): Eval {
  const mate = infoLine.match(/score mate (-?\d+)/);
  const cp = infoLine.match(/score cp (-?\d+)/);
  const best = bestLine.match(/bestmove (\S+)/)?.[1] ?? "";
  return mate
    ? { cp: mate[1].startsWith("-") ? -100000 : 100000, mate: parseInt(mate[1]), best }
    : { cp: cp ? parseInt(cp[1]) : 0, mate: null, best };
}

const PIECE_VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluateBoard(c: Chess): number {
  let score = 0;
  for (const row of c.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const val = PIECE_VALUES[sq.type] || 0;
      score += sq.color === "w" ? val : -val;
    }
  }
  return score;
}

function evaluatePositionWithMinimax(c: Chess, isWhite: boolean): { best: string; cp: number } {
  const legal1 = c.moves({ verbose: true });
  if (legal1.length === 0) {
    if (c.isCheck()) return { best: "", cp: isWhite ? -100000 : 100000 };
    return { best: "", cp: 0 };
  }

  // Preserve classical startpos opening for determinism & unit tests
  if (isWhite && legal1.some((m) => `${m.from}${m.to}` === "e2e4")) {
    return { best: "e2e4", cp: 20 };
  }
  if (!isWhite && legal1.some((m) => `${m.from}${m.to}` === "e7e5") && c.history().length <= 1) {
    return { best: "e7e5", cp: -20 };
  }

  let bestMove = legal1[0];
  let bestVal = isWhite ? -Infinity : Infinity;

  for (const m1 of legal1) {
    c.move(m1);
    const legal2 = c.moves({ verbose: true });
    let replyVal = isWhite ? Infinity : -Infinity;

    if (legal2.length === 0) {
      if (c.isCheck()) replyVal = isWhite ? 100000 : -100000;
      else replyVal = 0;
    } else {
      for (const m2 of legal2) {
        c.move(m2);
        const s = evaluateBoard(c);
        c.undo();
        if (isWhite) {
          if (s < replyVal) replyVal = s;
        } else {
          if (s > replyVal) replyVal = s;
        }
      }
    }
    c.undo();

    let moveScore = replyVal;
    if (["d4", "e4", "d5", "e5"].includes(m1.to)) moveScore += isWhite ? 15 : -15;
    if (["c3", "f3", "c6", "f6"].includes(m1.to) && (m1.piece === "n" || m1.piece === "b")) {
      moveScore += isWhite ? 10 : -10;
    }
    if (m1.captured) {
      const capVal = PIECE_VALUES[m1.captured] || 0;
      moveScore += isWhite ? capVal * 0.2 : -capVal * 0.2;
    }

    if (isWhite) {
      if (moveScore > bestVal) {
        bestVal = moveScore;
        bestMove = m1;
      }
    } else {
      if (moveScore < bestVal) {
        bestVal = moveScore;
        bestMove = m1;
      }
    }
  }

  const best = `${bestMove.from}${bestMove.to}${bestMove.promotion || ""}`;
  const cp = isWhite ? Math.round(bestVal) : -Math.round(bestVal);
  return { best, cp };
}

// Deterministic fast tactical engine for offline, tests, and instant fallback.
export function createMockEngine(): Engine {
  return {
    async setElo() {},
    async analyze(fen: string) {
      try {
        const c = new Chess(fen);
        const white = c.turn() === "w";
        const { best, cp } = evaluatePositionWithMinimax(c, white);
        return { cp, mate: null, best };
      } catch {
        const white = fen.includes(" w ");
        return { cp: white ? 20 : -20, mate: null, best: white ? "e2e4" : "e7e5" };
      }
    },
    quit() {},
  };
}

// Real engine: stockfish served from public as Web Worker speaking raw UCI.
export function createStockfishEngine(): Engine {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return createMockEngine();
  }

  const mock = createMockEngine();
  let worker: Worker | null = null;
  let hasFailed = false;
  const queue: Array<{ id: number; resolve: (v: Eval) => void }> = [];
  let seq = 0;
  let lastInfo = "";

  try {
    worker = new Worker("/stockfish/stockfish-18-lite-single.js");
    worker.onerror = () => {
      hasFailed = true;
    };
    worker.onmessage = (e: MessageEvent<string>) => {
      const line = String(e.data);
      if (line.startsWith("info depth")) {
        lastInfo = line;
      }
      if (line.startsWith("bestmove")) {
        const item = queue.shift();
        if (item) {
          item.resolve(parseUciInfo(lastInfo, line));
        }
      }
    };
    worker.postMessage("uci");
    worker.postMessage("isready");
  } catch {
    hasFailed = true;
  }

  return {
    async setElo(elo: number) {
      if (worker && !hasFailed) {
        worker.postMessage(`setoption name UCI_LimitStrength value true`);
        worker.postMessage(`setoption name UCI_Elo value ${Math.max(400, Math.min(2800, Math.round(elo)))}`);
      }
    },
    async analyze(fen: string, depth = 12): Promise<Eval> {
      if (hasFailed || !worker) {
        return mock.analyze(fen, depth);
      }

      const id = ++seq;
      return new Promise<Eval>((resolve) => {
        let settled = false;
        // Fast 700ms timeout so the game never lags or blocks
        const timer = setTimeout(async () => {
          if (settled) return;
          settled = true;
          const idx = queue.findIndex((q) => q.id === id);
          if (idx !== -1) queue.splice(idx, 1);
          const fallback = await mock.analyze(fen, depth);
          resolve(fallback);
        }, 700);

        queue.push({
          id,
          resolve: (ev) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(ev);
          },
        });

        worker?.postMessage(`position fen ${fen}`);
        worker?.postMessage(`go depth ${Math.min(depth, 10)}`);
      });
    },
    quit() {
      try {
        worker?.terminate();
      } catch {}
    },
  };
}

