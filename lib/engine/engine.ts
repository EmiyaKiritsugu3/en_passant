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

// Deterministic mock for tests/dev when WASM unavailable.
export function createMockEngine(): Engine {
  return {
    async setElo() {},
    async analyze(fen: string) {
      const white = fen.includes(" w ");
      return { cp: white ? 20 : -20, mate: null, best: "e2e4" };
    },
    quit() {},
  };
}

// Real engine: stockfish served from public as Web Worker speaking raw UCI.
export function createStockfishEngine(): Engine {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return createMockEngine();
  }
  const worker = new Worker("/stockfish/stockfish-18-lite-single.js");
  let seq = 0;
  const pending = new Map<number, (v: Eval) => void>();
  let lastInfo = "";
  worker.onmessage = (e: MessageEvent<string>) => {
    const line = String(e.data);
    if (line.startsWith("info depth")) lastInfo = line;
    if (line.startsWith("bestmove")) {
      const id = [...pending.keys()].pop()!;
      pending.get(id)?.(parseUciInfo(lastInfo, line));
      pending.delete(id);
    }
  };
  const send = (cmd: string) => worker.postMessage(cmd);
  send("uci");
  return {
    async setElo(elo: number) {
      send(`setoption name UCI_LimitStrength value true`);
      send(`setoption name UCI_Elo value ${Math.max(400, Math.min(2800, Math.round(elo)))}`);
    },
    analyze(fen: string, depth = 14): Promise<Eval> {
      const id = ++seq;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        send(`position fen ${fen}`);
        send(`go depth ${depth}`);
      });
    },
    quit() {
      worker.terminate();
    },
  };
}
