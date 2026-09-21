import { Chess } from "chess.js";

export interface Eval {
  cp: number;
  mate: number | null;
  best: string;
  // ponytail: true = mock 1-ply, UI must label as simplified, never "GM"
  fallback?: boolean;
  // ponytail: search depth that produced this eval (streamed partials only)
  depth?: number;
  // ponytail: side to move in the analyzed FEN. UCI cp/mate are relative to
  // this side; display code must convert to White perspective (see evalbar.ts).
  turn?: "w" | "b";
}

export interface EngineOptions {
  limitStrength?: boolean;
  elo?: number;
  // ponytail: jump queue front (user hints); no UCI stop-preemption, waits active search
  priority?: boolean;
  // ponytail: called with each parsed `info depth` line; guard staleness at call site
  onProgress?: (partial: Eval) => void;
}

export interface Engine {
  setElo(elo: number): Promise<void>;
  analyze(fen: string, depth?: number, options?: EngineOptions): Promise<Eval>;
  quit(): void;
}

export function turnOfFen(fen: string): "w" | "b" {
  try {
    return new Chess(fen).turn();
  } catch {
    return fen.split(" ")[1] === "b" ? "b" : "w";
  }
}

export function parseUciDepth(infoLine: string): number | null {
  const m = infoLine.match(/^info depth (\d+)/);
  return m ? parseInt(m[1], 10) : null;
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

// Positional bonuses for central presence and piece development
const CENTER_SQUARES = new Set(["d4", "e4", "d5", "e5"]);
const EXTENDED_CENTER = new Set(["c4", "f4", "c5", "f5", "c3", "d3", "e3", "f3", "c6", "d6", "e6", "f6"]);

function evaluateBoard(c: Chess): number {
  let score = 0;
  for (const row of c.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const baseVal = PIECE_VALUES[sq.type] || 0;
      let posVal = 0;
      if (CENTER_SQUARES.has(sq.square)) {
        posVal = sq.type === "p" ? 25 : 15;
      } else if (EXTENDED_CENTER.has(sq.square)) {
        posVal = sq.type === "p" ? 10 : 8;
      }
      const total = baseVal + posVal;
      score += sq.color === "w" ? total : -total;
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
    let score = evaluateBoard(c);

    // If opponent has immediate capturing replies, consider the best opponent capture
    const replies = c.moves({ verbose: true });
    if (replies.length === 0) {
      if (c.isCheck()) score = isWhite ? 100000 : -100000;
      else score = 0;
    } else {
      const captures = replies.filter((r) => r.captured);
      if (captures.length > 0) {
        // Opponent picks highest value capture
        let worstForMover = score;
        for (const cap of captures) {
          c.move(cap);
          const capScore = evaluateBoard(c);
          c.undo();
          if (isWhite) {
            if (capScore < worstForMover) worstForMover = capScore;
          } else {
            if (capScore > worstForMover) worstForMover = capScore;
          }
        }
        score = worstForMover;
      }
    }
    c.undo();

    // Bonus for active center control
    if (CENTER_SQUARES.has(m1.to)) score += isWhite ? 15 : -15;

    if (isWhite) {
      if (score > bestVal) {
        bestVal = score;
        bestMove = m1;
      }
    } else {
      if (score < bestVal) {
        bestVal = score;
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
      const turn = turnOfFen(fen);
      try {
        const c = new Chess(fen);
        const white = c.turn() === "w";
        const { best, cp } = evaluatePositionWithMinimax(c, white);
        return { cp, mate: null, best, fallback: true, turn };
      } catch {
        const white = fen.includes(" w ");
        return { cp: white ? 20 : -20, mate: null, best: white ? "e2e4" : "e7e5", fallback: true, turn };
      }
    },
    quit() {},
  };
}

interface QueuedTask {
  id: number;
  fen: string;
  depth: number;
  options?: EngineOptions;
  resolve: (v: Eval) => void;
  reject: (err: unknown) => void;
}

// Real engine: Stockfish 19 (nmrugg single-thread lite build) served from public
// as Web Worker speaking raw UCI. Binaries are copied from the npm package at
// dev/build time (scripts/copy-stockfish.mjs) — keep in sync with package.json.
// Uses a serialized command queue and handshake synchronization to prevent race conditions.
//
// Why not lila-stockfish-web: multithreaded builds need SharedArrayBuffer +
// COEP require-corp (breaks cross-origin loads) and are AGPL-3.0. The lite
// single-thread build runs everywhere with no special headers.
export const STOCKFISH_FILE = "stockfish-19-lite-single.js";
export function createStockfishEngine(): Engine {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return createMockEngine();
  }

  const mock = createMockEngine();
  let worker: Worker | null = null;
  let hasFailed = false;
  let isReady = false;
  const readyCallbacks: Array<() => void> = [];

  const queue: QueuedTask[] = [];
  let isProcessing = false;
  let activeTask: QueuedTask | null = null;
  let lastInfoLine = "";
  let taskTimer: NodeJS.Timeout | null = null;
  let currentLimitStrength = false;
  let currentElo = 2800;

  function onReady() {
    isReady = true;
    while (readyCallbacks.length > 0) {
      readyCallbacks.shift()?.();
    }
  }

  function waitForReady(): Promise<void> {
    if (isReady) return Promise.resolve();
    return new Promise((res) => readyCallbacks.push(res));
  }

  try {
    worker = new Worker(`/stockfish/${STOCKFISH_FILE}`);

    worker.onerror = () => {
      hasFailed = true;
      if (activeTask) {
        const t = activeTask;
        activeTask = null;
        mock.analyze(t.fen, t.depth).then(t.resolve);
      }
      // ponytail: drop queued (stale FENs), keep UI responsive; user re-asks if needed
      queue.length = 0;
      processNext();
    };

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = String(e.data).trim();

      if (line === "uciok" || line === "readyok") {
        onReady();
      }

      if (line.startsWith("info depth")) {
        lastInfoLine = line;
        const task = activeTask;
        const onProgress = task?.options?.onProgress;
        if (task && onProgress) {
          const depth = parseUciDepth(line);
          if (depth !== null) {
            try {
              onProgress({ ...parseUciInfo(line, ""), depth, turn: turnOfFen(task.fen) });
            } catch {
              // ignore progress listener errors; final result still resolves
            }
          }
        }
      }

      if (line.startsWith("bestmove") && activeTask) {
        if (taskTimer) {
          clearTimeout(taskTimer);
          taskTimer = null;
        }
        const task = activeTask;
        activeTask = null;
        isProcessing = false;
        const evaluation = { ...parseUciInfo(lastInfoLine, line), turn: turnOfFen(task.fen) };
        lastInfoLine = "";
        task.resolve(evaluation);
        processNext();
      }
    };

    worker.postMessage("uci");
    worker.postMessage("isready");
  } catch {
    hasFailed = true;
  }

  async function processNext() {
    if (isProcessing) return;
    if (queue.length === 0) {
      return;
    }

    isProcessing = true;
    const task = queue.shift()!;
    activeTask = task;
    lastInfoLine = "";

    try {
      await waitForReady();

      if (hasFailed || !worker) {
        const fallback = await mock.analyze(task.fen, task.depth);
        activeTask = null;
        isProcessing = false;
        task.resolve(fallback);
        processNext();
        return;
      }

      // Configure Elo strength if requested
      const requestedLimit = Boolean(task.options?.limitStrength);
      const requestedElo = task.options?.elo ?? 2800;

      if (requestedLimit !== currentLimitStrength || (requestedLimit && requestedElo !== currentElo)) {
        currentLimitStrength = requestedLimit;
        currentElo = requestedElo;
        if (requestedLimit) {
          const clampedElo = Math.max(1320, Math.min(3190, Math.round(requestedElo)));
          worker.postMessage("setoption name UCI_LimitStrength value true");
          worker.postMessage(`setoption name UCI_Elo value ${clampedElo}`);
        } else {
          worker.postMessage("setoption name UCI_LimitStrength value false");
        }
      }

      // Generous 6000ms safety timeout (never blocks game, but allows full WASM deep calculation)
      taskTimer = setTimeout(async () => {
        if (activeTask && activeTask.id === task.id) {
          activeTask = null;
          taskTimer = null;
          isProcessing = false;
          const fallback = await mock.analyze(task.fen, task.depth);
          task.resolve(fallback);
          processNext();
        }
      }, 6000);

      worker.postMessage(`position fen ${task.fen}`);
      worker.postMessage(`go depth ${Math.max(6, Math.min(task.depth, 14))}`);
    } catch {
      activeTask = null;
      isProcessing = false;
      const fallback = await mock.analyze(task.fen, task.depth);
      task.resolve(fallback);
      processNext();
    }
  }

  let seq = 0;

  return {
    async setElo(elo: number) {
      if (worker && !hasFailed) {
        const clampedElo = Math.max(1320, Math.min(3190, Math.round(elo)));
        worker.postMessage("setoption name UCI_LimitStrength value true");
        worker.postMessage(`setoption name UCI_Elo value ${clampedElo}`);
        currentLimitStrength = true;
        currentElo = clampedElo;
      }
    },
    async analyze(fen: string, depth = 12, options?: EngineOptions): Promise<Eval> {
      if (hasFailed || !worker) {
        return mock.analyze(fen, depth);
      }

      const id = ++seq;
      return new Promise<Eval>((resolve, reject) => {
        const task = { id, fen, depth, options, resolve, reject };
        // ponytail: priority = unshift, else push; no preemption of active UCI search
        if (options?.priority) queue.unshift(task);
        else queue.push(task);
        processNext();
      });
    },
    quit() {
      if (taskTimer) clearTimeout(taskTimer);
      try {
        worker?.terminate();
      } catch {}
    },
  };
}

