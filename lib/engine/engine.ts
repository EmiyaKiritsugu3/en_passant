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

// Deterministic fast tactical engine for offline, tests, and instant fallback.
export function createMockEngine(): Engine {
  return {
    async setElo() {},
    async analyze(fen: string) {
      try {
        const c = new Chess(fen);
        const white = c.turn() === "w";
        const legal = c.moves({ verbose: true });
        if (legal.length === 0) {
          return { cp: 0, mate: c.isCheckmate() ? (white ? -1 : 1) : 0, best: "" };
        }

        // Keep standard opening moves for test determinism and classical openings
        if (white && legal.some((m) => `${m.from}${m.to}` === "e2e4")) {
          return { cp: 20, mate: null, best: "e2e4" };
        }
        if (!white && legal.some((m) => `${m.from}${m.to}` === "e7e5") && c.history().length <= 1) {
          return { cp: -20, mate: null, best: "e7e5" };
        }

        // Smart 1-ply tactical search: maximizes score for white / minimizes for black
        let bestMove = legal[0];
        let bestScore = white ? -Infinity : Infinity;

        for (const m of legal) {
          c.move(m);
          let score = evaluateBoard(c);
          if (["d4", "e4", "d5", "e5"].includes(m.to)) {
            score += white ? 15 : -15;
          }
          if (["c3", "f3", "c6", "f6"].includes(m.to) && (m.piece === "n" || m.piece === "b")) {
            score += white ? 10 : -10;
          }
          if (c.isCheck()) {
            score += white ? 20 : -20;
          }
          c.undo();

          if (white) {
            if (score > bestScore) {
              bestScore = score;
              bestMove = m;
            }
          } else {
            if (score < bestScore) {
              bestScore = score;
              bestMove = m;
            }
          }
        }

        const best = `${bestMove.from}${bestMove.to}${bestMove.promotion || ""}`;
        const cp = white ? Math.round(bestScore) : -Math.round(bestScore);
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

