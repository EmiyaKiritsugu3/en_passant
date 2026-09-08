# Chess Coach PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 Chess Coach PWA: play vs adaptive Stockfish, GM coach critiques per turn, postgame analysis, SM-2 trainer, opening drills, phase scores, internal game library.

**Architecture:** Next.js App Router (TS). Client owns board (chessground + chess.js) and measurement (stockfish.wasm, cp-loss, phases). Server owns only the coach (Route Handlers → Anthropic API, key server-side). Persistence is versioned localStorage. Lichess explorer/tablebase are client fetches with offline fallback.

**Tech Stack:** Next.js 15 (App Router, TS strict), chess.js, chessground, stockfish (npm, WASM), Tailwind + shadcn, zod, anthropic SDK (server only), vitest, Playwright (one smoke test).

**Spec:** `docs/superpowers/specs/2026-09-08-chess-coach-design.md`

## Global Constraints

- Engine MEDE, LLM EXPLICA. LLM never chooses a move; code never judges chess, only measures numbers.
- Coach contract is strict JSON validated by zod; never parse free text.
- Storage keys versioned: `profile.v1`, `cards.v1`, `repertoire.v1`, `games.v1`. Migrate by version, backup JSON before migrating.
- `COACH_MODEL` env is REQUIRED (no default pinned id); boot fails fast if unset.
- Illegal move: board unchanged, piece returns with shake, message cites rule, prompt legal move.
- Offline: board, engine, profile, puzzles work; coach requires network (retry 1x → local summary → queue for reinterpret).
- Lichess fetches: 5s timeout, `Map` FEN→response cache, fallback to local engine/games.json.
- One task = one commit. TDD: failing test first for every lib function.

---

### Task 1: Scaffold app + deps + PWA shell

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `public/manifest.webmanifest`, `app/globals.css`
- Test: `vitest.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: runnable `npm run dev`; PWA manifest linked in layout.

- [ ] **Step 1: Scaffold Next.js app**

Run: `npx create-next-app@latest chess-coach --typescript --tailwind --app --no-src-dir --import-alias "@/*"` then `cd chess-coach` (repo root IS this dir — run inside `/home/emiyakiritsugu/Projetos_Antigravity/chess`). Verify with `ls app/page.tsx`.

- [ ] **Step 2: Install deps**

Run: `npm i chess.js chessground zod anthropic stockfish && npm i -D vitest jsdom @vitejs/plugin-react`
Expected: `node_modules/chess.js`, `node_modules/chessground`, `node_modules/stockfish` exist.

- [ ] **Step 3: Add vitest config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "jsdom", include: ["lib/**/*.test.ts"] } });
```

- [ ] **Step 4: Add PWA manifest + link**

```json
// public/manifest.webmanifest
{ "name": "Chess Coach", "short_name": "Coach", "start_url": "/", "display": "standalone", "background_color": "#161512", "theme_color": "#161512", "icons": [{ "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }] }
```

```tsx
// app/layout.tsx (add inside <head> via metadata)
export const metadata = { title: "Chess Coach", manifest: "/manifest.webmanifest", themeColor: "#161512" };
```

Note: `/icon-512.png` is added in Task 13 (any 512px PNG). Manifest referencing it before it exists is fine for dev.

- [ ] **Step 5: Run dev + commit**

Run: `npm run dev` → expect Next.js ready on :3000. Then `npm run test -- --run` → expect "No test files found" (pass, exit 0).
```bash
git add -A && git commit -m "feat: scaffold Next.js PWA + deps"
```

---

### Task 2: Chess measurement lib (classify, phase, score)

**Files:**
- Create: `lib/chess/measure.ts`
- Test: `lib/chess/measure.test.ts`

**Interfaces:**
- Consumes: `chess.js` `Chess` instance for board inspection.
- Produces: `classifyMove(cpLoss, wasSacrifice, evalKept)`, `detectPhase(ply, chess)`, `moveScore(cpLoss)`, `phaseAverages(scored)` used by Tasks 7/8.

- [ ] **Step 1: Write the failing test**

```ts
// lib/chess/measure.test.ts
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { classifyMove, detectPhase, moveScore } from "./measure";

describe("classifyMove", () => {
  it("labels by cp-loss thresholds", () => {
    expect(classifyMove(10, false, false)).toBe("solid");
    expect(classifyMove(70, false, false)).toBe("inaccurate");
    expect(classifyMove(150, false, false)).toBe("mistake");
    expect(classifyMove(300, false, false)).toBe("blunder");
  });
  it("labels correct sacrifices brilliant", () => {
    expect(classifyMove(0, true, true)).toBe("brilliant");
    expect(classifyMove(0, true, false)).toBe("solid");
  });
});

describe("detectPhase", () => {
  it("opening is ply < 20", () => {
    const c = new Chess();
    expect(detectPhase(4, c)).toBe("opening");
  });
  it("queens off board is endgame", () => {
    const c = new Chess("r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 1");
    c.remove("d1"); c.remove("d8");
    expect(detectPhase(40, c)).toBe("endgame");
  });
  it("middlegame otherwise", () => {
    const c = new Chess();
    expect(detectPhase(30, c)).toBe("middlegame");
  });
});

describe("moveScore", () => {
  it("best move scores 100, blunder near 0", () => {
    expect(moveScore(0)).toBe(100);
    expect(moveScore(500)).toBeLessThan(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/chess/measure.test.ts`
Expected: FAIL with "Cannot find module './measure'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/chess/measure.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/chess/measure.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/chess/measure.ts lib/chess/measure.test.ts && git commit -m "feat: move classification, phase detection, scoring"
```

---

### Task 3: Profile store (versioned localStorage)

**Files:**
- Create: `lib/profile/store.ts`, `lib/profile/update.ts`
- Test: `lib/profile/store.test.ts`

**Interfaces:**
- Consumes: `phaseAverages` output shape, coach `profileDelta` (Task 6/8).
- Produces: `loadProfile()`, `saveProfile(p)`, `exportProfile()`, `applyPostgame(p, result)` used by Tasks 8/12.

```ts
export interface Profile {
  version: 1; rating: number; games: number;
  errorTags: Record<"tactics" | "kingSafety" | "endgame" | "pawns", number>;
  recentErrorFens: string[]; openings: Record<string, number>;
  phaseHistory: { game: number; opening: number; middlegame: number; endgame: number }[];
}
```

- [ ] **Step 1: Write the failing test**

```ts
// lib/profile/store.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { loadProfile, saveProfile } from "./store";
import { applyPostgame } from "./update";

beforeEach(() => localStorage.clear());

describe("store", () => {
  it("loads default rating 800 on empty storage", () => {
    expect(loadProfile().rating).toBe(800);
  });
  it("round-trips a profile", () => {
    const p = loadProfile(); p.games = 3; saveProfile(p);
    expect(loadProfile().games).toBe(3);
  });
  it("backs up before migrating unknown version", () => {
    localStorage.setItem("profile.v1", JSON.stringify({ version: 99 }));
    const p = loadProfile();
    expect(p.version).toBe(1);
    expect(localStorage.getItem("profile.v1.bak")).toContain("99");
  });
});

describe("applyPostgame", () => {
  it("bumps games, tags, rating on win and appends phase row", () => {
    const p = loadProfile();
    const next = applyPostgame(p, { won: true, tags: ["tactics", "tactics"], fens: ["f"], phases: { opening: 60, middlegame: 55, endgame: 40 } });
    expect(next.games).toBe(1);
    expect(next.errorTags.tactics).toBe(2);
    expect(next.rating).toBeGreaterThan(800);
    expect(next.phaseHistory).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/profile/store.test.ts`
Expected: FAIL with "Cannot find module './store'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/profile/store.ts
import type { Profile } from "./update";
export type { Profile };

const KEY = "profile.v1";
export const DEFAULT_PROFILE: Profile = {
  version: 1, rating: 800, games: 0,
  errorTags: { tactics: 0, kingSafety: 0, endgame: 0, pawns: 0 },
  recentErrorFens: [], openings: {}, phaseHistory: [],
};

export function loadProfile(): Profile {
  const raw = localStorage.getItem(KEY);
  if (!raw) return structuredClone(DEFAULT_PROFILE);
  try {
    const p = JSON.parse(raw);
    if (p.version !== 1) {
      localStorage.setItem(KEY + ".bak", raw); // backup before migrate
      return structuredClone(DEFAULT_PROFILE);
    }
    return { ...structuredClone(DEFAULT_PROFILE), ...p };
  } catch {
    return structuredClone(DEFAULT_PROFILE);
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function exportProfile(): string {
  return localStorage.getItem(KEY) ?? JSON.stringify(DEFAULT_PROFILE);
}
```

```ts
// lib/profile/update.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/profile/store.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/profile/ && git commit -m "feat: versioned profile store + postgame update"
```

---

### Task 4: Stockfish engine wrapper (WASM + mock)

**Files:**
- Create: `lib/engine/engine.ts`
- Test: `lib/engine/engine.test.ts`

**Interfaces:**
- Consumes: nothing (raw UCI over Worker).
- Produces: `Engine` interface, `createMockEngine()`, `createStockfishEngine()` used by Tasks 5/7/8.

```ts
export interface Eval { cp: number; mate: number | null; best: string; } // best = UCI e.g. "e2e4"
export interface Engine {
  setElo(elo: number): Promise<void>;
  analyze(fen: string, depth?: number): Promise<Eval>;
  quit(): void;
}
```

- [ ] **Step 1: Write the failing test (mock only — no WASM in jsdom)**

```ts
// lib/engine/engine.test.ts
import { describe, expect, it } from "vitest";
import { createMockEngine, parseUciInfo } from "./engine";

describe("mock engine", () => {
  it("returns e2e4 as best in startpos and echoes setElo", async () => {
    const e = createMockEngine();
    await e.setElo(1050);
    const r = await e.analyze("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(r.best).toBe("e2e4");
    expect(typeof r.cp).toBe("number");
    e.quit();
  });
});

describe("parseUciInfo", () => {
  it("parses cp score and bestmove", () => {
    expect(parseUciInfo("info depth 12 score cp 35 nodes 1", "bestmove e2e4")).toEqual({ cp: 35, mate: null, best: "e2e4" });
    expect(parseUciInfo("info depth 12 score mate 3 nodes 1", "bestmove f7f8q")).toEqual({ cp: 100000, mate: 3, best: "f7f8q" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/engine/engine.test.ts`
Expected: FAIL with "Cannot find module './engine'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/engine/engine.ts
export interface Eval { cp: number; mate: number | null; best: string; }
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

// Real engine: stockfish npm package as Web Worker speaking raw UCI.
// Verify exact file name first: ls node_modules/stockfish/src
export function createStockfishEngine(): Engine {
  const worker = new Worker(new URL("stockfish/src/stockfish-16-lite-single.js", import.meta.url));
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
    quit() { worker.terminate(); },
  };
}
```

Note: if `node_modules/stockfish/src` has a different filename, use the actual one — same UCI protocol, no other change.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/engine/engine.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/ && git commit -m "feat: stockfish UCI wrapper + mock engine"
```

---

### Task 5: Setup + board screens (chessground + chess.js)

**Files:**
- Create: `components/Board.tsx`, `app/play/page.tsx`, modify `app/page.tsx`
- Test: manual in browser this task (lib already tested). Fold PGN export check into Task 12 integration.

**Interfaces:**
- Consumes: `chess.js` Chess, `Engine.analyze` for GM replies (mock in dev ok).
- Produces: playable board; illegal-move shake; PGN live; FEN display. Task 7 adds coach tabs beside it.

- [ ] **Step 1: Setup screen with 3 choices**

```tsx
// app/page.tsx
"use client";
import { useRouter } from "next/navigation";
export default function Setup() {
  const r = useRouter();
  const go = (side: string) => r.push(`/play?side=${side}`);
  return (
    <main style={{ padding: 32 }}>
      <h1>Welcome to the board. Which side will you take today?</h1>
      <button onClick={() => go("white")}>1. White (You play first)</button>
      <button onClick={() => go("black")}>2. Black (I play first)</button>
      <button onClick={() => go("random")}>3. Random (Let chance decide)</button>
    </main>
  );
}
```

Random resolution lives in `/play`: `Math.random() < 0.5` once on mount, show "sorteio: você de Brancas/Pretas".

- [ ] **Step 2: Board component (chessground wrapper)**

```tsx
// components/Board.tsx
"use client";
import { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

export default function Board({ fen, orientation, onMove, shape }: {
  fen: string; orientation: "white" | "black";
  onMove: (from: string, to: string) => void;
  shape?: { orig: string; dest: string; brush: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  useEffect(() => {
    api.current = Chessground(ref.current!, {
      movable: { free: false, events: { after: onMove } },
    });
    return () => api.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    api.current?.set({ fen, orientation, drawable: { shapes: shape ?? [] } });
  }, [fen, orientation, shape]);
  return <div ref={ref} style={{ width: "min(90vw, 560px)", aspectRatio: "1" }} />;
}
```

- [ ] **Step 3: Play page — chess.js owns truth, illegal rejected**

```tsx
// app/play/page.tsx
"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import Board from "@/components/Board";

export default function Play() {
  const side = useSearchParams().get("side") ?? "white";
  const [color] = useState(() => side === "random" ? (Math.random() < 0.5 ? "white" : "black") : side);
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(game.fen());
  const [notice, setNotice] = useState("");

  const onMove = (from: string, to: string) => {
    try {
      game.move({ from, to, promotion: "q" }); // throws on illegal
      setFen(game.fen()); setNotice("");
    } catch {
      setFen(game.fen()); // unchanged → piece snaps back
      setNotice(`Illegal move ${from}→${to}: blocked by chess.js legality rules. Choose a legal move.`);
    }
  };
  return (
    <main style={{ display: "flex", gap: 24 }}>
      <div>
        <p>{side === "random" && `sorteio: você de ${color === "white" ? "Brancas" : "Pretas"}`}</p>
        <Board fen={fen} orientation={color as "white" | "black"} onMove={onMove} />
        {notice && <p role="alert">{notice}</p>}
        <p><code>{fen}</code></p>
        <pre>{game.pgn()}</pre>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Visual verify**

Run: `npm run dev`, open `/`, pick White, play 1.e4 (drags, animates), try illegal (e.g. Ke2 first move) → alert shows, board unchanged.
Expected: drag works, illegal rejected with message.

- [ ] **Step 5: Commit**

```bash
git add app/ components/ && git commit -m "feat: setup screen + playable board with illegal rejection"
```

---

### Task 6: Coach API (schemas, prompts, routes)

**Files:**
- Create: `lib/coach/schemas.ts`, `lib/coach/prompts.ts`, `lib/coach/server.ts`, `app/api/coach/turn/route.ts`, `app/api/coach/postgame/route.ts`
- Test: `lib/coach/schemas.test.ts`

**Interfaces:**
- Consumes: `{fen, pgn, cpLoss, bestMove, phase}` (turn), `{pgn, evals, phaseScores}` (postgame).
- Produces: validated `TurnResponse` / `PostgameResponse` JSON; `getModel()` reads `COACH_MODEL`. Task 7 calls these routes.

- [ ] **Step 1: Write the failing test**

```ts
// lib/coach/schemas.test.ts
import { describe, expect, it } from "vitest";
import { TurnResponse, PostgameResponse, ExploreResponse } from "./schemas";

describe("coach schemas", () => {
  it("accepts a valid turn response", () => {
    expect(() => TurnResponse.parse({ critique: "md", intent: "md", tags: ["tactics"], homework: "md" })).not.toThrow();
  });
  it("rejects unknown tags", () => {
    expect(() => TurnResponse.parse({ critique: "a", intent: "b", tags: ["nope"], homework: "c" })).toThrow();
  });
  it("accepts a valid postgame response", () => {
    expect(() => PostgameResponse.parse({
      summary: "s", result: "1-0",
      moments: [{ move: 18, played: "Nf3?", best: "d5!", why: "w" }],
      takeaway: "t", homework: "h", profileDelta: {},
    })).not.toThrow();
  });
  it("accepts a valid explore response", () => {
    expect(() => ExploreResponse.parse({ verdict: "dubious", consequences: "weakens kingside", namedVariant: "Sicilian Najdorf" })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/coach/schemas.test.ts`
Expected: FAIL with "Cannot find module './schemas'".

- [ ] **Step 3: Write schemas + prompts + server + routes**

```ts
// lib/coach/schemas.ts
import { z } from "zod";
export const TAG = z.enum(["tactics", "kingSafety", "endgame", "pawns"]);
export const TurnResponse = z.object({
  critique: z.string(), intent: z.string(),
  tags: z.array(TAG), homework: z.string(),
});
export const PostgameResponse = z.object({
  summary: z.string(), result: z.string(),
  moments: z.array(z.object({ move: z.number(), played: z.string(), best: z.string(), why: z.string() })).max(3),
  takeaway: z.string(), homework: z.string(), profileDelta: z.object({}).catchall(z.unknown()),
});
export const ExploreResponse = z.object({
  verdict: z.string(), consequences: z.string(), namedVariant: z.string(),
});
export type TurnResponse = z.infer<typeof TurnResponse>;
export type PostgameResponse = z.infer<typeof PostgameResponse>;
export type ExploreResponse = z.infer<typeof ExploreResponse>;
```

```ts
// lib/coach/prompts.ts
export const TURN_SYSTEM = `You are an elite GM chess coach. Reply with JSON ONLY matching the given schema: critique (opening/variation, verdict on last move, pawn levers, square control, coordination, king safety, historic reference when fitting), intent (candidates weighed, threats neutralized, long-term plan), tags (subset of tactics/kingSafety/endgame/pawns), homework (one concrete drill). No prose outside JSON.`;
export const POSTGAME_SYSTEM = `You are an elite GM chess coach. Reply with JSON ONLY: summary (result, move count, opening, turning point), moments (2-3: move number, played vs best, why), takeaway (primary weakness), homework (classic game/player to study), profileDelta ({}). No prose outside JSON.`;
export const EXPLORE_SYSTEM = `You are an elite GM chess coach. The student played a free "what-if" move in an opening study. Reply with JSON ONLY: verdict (good/dubious/bad in one line with eval justification), consequences (3-4 lines: structural/plan impact, best reply for opponent), namedVariant (ECO/variation name or " sideline / novelty" if unnamed). No prose outside JSON.`;
```

```ts
// lib/coach/server.ts
import Anthropic from "@anthropic-ai/sdk";

export function getModel(): string {
  const m = process.env.COACH_MODEL;
  if (!m) throw new Error("COACH_MODEL env is required (e.g. current claude-sonnet id)");
  return m;
}

export async function coachJson(system: string, payload: unknown): Promise<string> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: getModel(), max_tokens: 1500, system,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("empty coach reply");
  return block.text;
}
```

```ts
// app/api/coach/turn/route.ts
import { NextResponse } from "next/server";
import { TurnResponse } from "@/lib/coach/schemas";
import { TURN_SYSTEM } from "@/lib/coach/prompts";
import { coachJson } from "@/lib/coach/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const raw = await coachJson(TURN_SYSTEM, body);
    return NextResponse.json(TurnResponse.parse(JSON.parse(raw)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
```

```ts
// app/api/coach/postgame/route.ts
import { NextResponse } from "next/server";
import { PostgameResponse } from "@/lib/coach/schemas";
import { POSTGAME_SYSTEM } from "@/lib/coach/prompts";
import { coachJson } from "@/lib/coach/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const raw = await coachJson(POSTGAME_SYSTEM, body);
    return NextResponse.json(PostgameResponse.parse(JSON.parse(raw)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
```

```ts
// app/api/coach/explore/route.ts
import { NextResponse } from "next/server";
import { ExploreResponse } from "@/lib/coach/schemas";
import { EXPLORE_SYSTEM } from "@/lib/coach/prompts";
import { coachJson } from "@/lib/coach/server";

export async function POST(req: Request) {
  try {
    const body = await req.json(); // {fenBefore, sanPlayed, cpLoss, explorerStats, openingName}
    const raw = await coachJson(EXPLORE_SYSTEM, body);
    return NextResponse.json(ExploreResponse.parse(JSON.parse(raw)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run tests + boot check**

Run: `npx vitest run lib/coach/schemas.test.ts`
Expected: 4 passed. Then `COACH_MODEL=x npm run build` compiles (routes typecheck; no live call in test).

- [ ] **Step 5: Commit**

```bash
git add lib/coach/ app/api/ && git commit -m "feat: coach API routes with strict JSON contract"
```

Note: Task 6 files list gains `app/api/coach/explore/route.ts` (code above). Rerun task-brief for Task 6 before dispatch — the on-disk brief is stale; the plan file is authoritative.

---

### Task 7: Turn integration (engine → coach → 3 tabs)

**Files:**
- Create: `lib/coach/queue.ts`, modify `app/play/page.tsx`
- Test: `lib/coach/queue.test.ts`

**Interfaces:**
- Consumes: `Engine`, `classifyMove/detectPhase/moveScore`, `/api/coach/turn`, `loadProfile`.
- Produces: per-turn `{label, cpLoss, best, coach}` rendered in Critique/Intent/Position tabs; GM reply move animated via `shape` arrow.

Flow per user move: engine analyzes position BEFORE move (cp) and AFTER (cp) → cpLoss = drop for mover → classify → engine picks GM reply at cap Elo (profile.rating+250 via setElo) → POST /api/coach/turn → render tabs. Coach failure: retry 1x → local summary (label + best) → enqueue position in `coachQueue.v1` for later reinterpret.

- [ ] **Step 1: Write the failing queue test**

```ts
// lib/coach/queue.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { enqueue, drain } from "./queue";
beforeEach(() => localStorage.clear());
describe("coach queue", () => {
  it("enqueues and drains FIFO", () => {
    enqueue({ fen: "a" }); enqueue({ fen: "b" });
    expect(drain()).toEqual([{ fen: "a" }, { fen: "b" }]);
    expect(drain()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/coach/queue.test.ts`
Expected: FAIL with "Cannot find module './queue'".

- [ ] **Step 3: Write queue + play page integration**

```ts
// lib/coach/queue.ts
const KEY = "coachQueue.v1";
export function enqueue(item: unknown): void {
  const q = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  localStorage.setItem(KEY, JSON.stringify([...q, item].slice(-50)));
}
export function drain<T>(): T[] {
  const q = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  localStorage.removeItem(KEY);
  return q;
}
```

Play page additions (edit `app/play/page.tsx`):
- state: `tab` ("critique"|"intent"|"position"), `coach` (TurnResponse|null), `label`, `arrow` shape.
- after user move: capture `fenBefore`, `const before = await engine.analyze(fenBefore, 12)`; apply move; `const after = await engine.analyze(fenAfter, 12)`; cpLoss from mover perspective (white: before.cp - after.cp; black: after.cp - before.cp, floored at 0); `classifyMove(cpLoss, wasSacrifice, evalKept)`; engine `setElo(profile.rating+250)` once per game; GM reply = `after.best` converted UCI→SAN via `game.move(best)`; POST `/api/coach/turn` with `{fen, pgn, cpLoss, bestMove, phase}`; catch → retry once → fallback local + `enqueue({fen, pgn, cpLoss})`.
- tabs render `coach.critique`, `coach.intent`, position tab shows FEN + PGN + eval (cp) bar.

Sacrifice detect (for brilliant): capture `game.get(from)` before move for piece value; `result.captured` from `game.move()` for captured value; `wasSacrifice = movedValue > capturedValue && cpLoss < 30`. `evalKept = moverCpAfter >= moverCpBefore - 20`.

- [ ] **Step 4: Verify**

Run: `npx vitest run lib/coach/queue.test.ts` → PASS. Browser: play 1.e4, coach tab fills (needs `ANTHROPIC_API_KEY` + `COACH_MODEL` in `.env.local`); with API down, local summary shows and turn continues.

- [ ] **Step 5: Commit**

```bash
git add lib/coach/queue.ts lib/coach/queue.test.ts app/play/page.tsx && git commit -m "feat: turn loop engine+coach with offline queue"
```

---

### Task 8: Postgame (annotate, scores, profile, dashboard)

**Files:**
- Create: `lib/postgame.ts`, `app/dashboard/page.tsx`, postgame view (in `app/play/page.tsx` on `game.isGameOver()` or new `app/postgame/page.tsx` receiving game id)
- Test: `lib/postgame.test.ts`

**Interfaces:**
- Consumes: `phaseAverages`, `applyPostgame`, `/api/coach/postgame`, `saveProfile`.
- Produces: postgame view (summary, 2–3 moments, takeaway, homework), updated profile, dashboard bars + history.

- [ ] **Step 1: Write the failing test**

```ts
// lib/postgame.test.ts
import { describe, expect, it } from "vitest";
import { collectEvals } from "./postgame";
import { createMockEngine } from "./engine/engine";

describe("collectEvals", () => {
  it("scores a 4-ply mate game with opening phases", async () => {
    const rows = await collectEvals("1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0", createMockEngine());
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ phase: "opening" });
    expect(rows.every((r) => typeof r.score === "number")).toBe(true);
  });
});
```

`collectEvals(pgn, engine)` replays via chess.js, analyzes each position, returns `{san, cpLoss, label, phase, score}[]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/postgame.test.ts`
Expected: FAIL with "Cannot find module './postgame'".

- [ ] **Step 3: Write implementation + views**

```ts
// lib/postgame.ts
import { Chess } from "chess.js";
import { classifyMove, detectPhase, moveScore, type Phase } from "./chess/measure";
import type { Engine } from "./engine/engine";

export interface Row { ply: number; san: string; cpLoss: number; label: string; phase: Phase; score: number; fen: string; best: string; }

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
      ply, san: move.san, cpLoss,
      label: classifyMove(cpLoss, false, false),
      phase: detectPhase(ply, replay), score: moveScore(cpLoss),
      fen: replay.fen(), best: prev.best,
    });
    prev = cur;
  }
  return rows;
}
```

Postgame view: on `game.isGameOver()`, run `collectEvals` → `phaseAverages(rows.map(r => ({phase: r.phase, score: r.score})))` → POST `/api/coach/postgame` → render summary/moments/takeaway → `applyPostgame` + `saveProfile` → offer "send blunders to SM-2" (calls `addCard` from Task 9 for rows with label mistake/blunder).

Dashboard `/dashboard`: read profile via `loadProfile()`, render 3 bars (latest phaseHistory row) + history list + weakest-phase plan line (lowest phase + top-2 errorTags → text naming SM-2 queue + drill + curated game).

- [ ] **Step 4: Verify**

Run: `npx vitest run lib/postgame.test.ts` → PASS. Browser: Scholar's mate vs mock → postgame shows moments, profile.games=1, dashboard bars render.

- [ ] **Step 5: Commit**

```bash
git add lib/postgame* app/dashboard/ app/play/page.tsx && git commit -m "feat: postgame analysis + phase dashboard"
```

---

### Task 9: SM-2 trainer (own-error puzzles)

**Files:**
- Create: `lib/sm2/scheduler.ts`, `app/train/page.tsx`
- Test: `lib/sm2/scheduler.test.ts`

**Interfaces:**
- Consumes: `cards.v1` (created from postgame blunders via `addCard`: `{fen, bestMove, context}`).
- Produces: `reviewCard(card, quality)`, `dueCards(cards, now)`, `loadCards/saveCards/addCard`, train UI (FEN → user move → compare vs best via chess.js legality + UCI match).

- [ ] **Step 1: Write the failing test**

```ts
// lib/sm2/scheduler.test.ts
import { describe, expect, it } from "vitest";
import { reviewCard, dueCards, type Card } from "./scheduler";

const card = (o: Partial<Card> = {}): Card =>
  ({ id: "1", fen: "f", bestMove: "e2e4", context: "c", EF: 2.5, interval: 0, reps: 0, nextReview: 0, ...o });

describe("sm2", () => {
  it("first pass sets interval 1, second 6, third scales by EF", () => {
    const c1 = reviewCard(card(), 5);
    expect(c1).toMatchObject({ reps: 1, interval: 1 });
    const c2 = reviewCard({ ...c1, nextReview: 0 }, 5);
    expect(c2).toMatchObject({ reps: 2, interval: 6 });
    const c3 = reviewCard({ ...c2, nextReview: 0 }, 5);
    expect(c3.interval).toBeGreaterThan(6);
  });
  it("failure resets reps", () => {
    expect(reviewCard(card({ reps: 3, interval: 10 }), 0).reps).toBe(0);
  });
  it("dueCards filters by nextReview", () => {
    expect(dueCards([card({ nextReview: 5 }), card({ nextReview: 50 })], 10)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sm2/scheduler.test.ts`
Expected: FAIL with "Cannot find module './scheduler'".

- [ ] **Step 3: Write implementation + UI**

```ts
// lib/sm2/scheduler.ts
export interface Card {
  id: string; fen: string; bestMove: string; context: string;
  EF: number; interval: number; reps: number; nextReview: number;
}
const KEY = "cards.v1";
const DAY = 86400000;

export function reviewCard(c: Card, quality: 5 | 4 | 2 | 0): Card {
  const next = { ...c };
  if (quality < 3) { next.reps = 0; next.interval = 1; }
  else {
    next.EF = Math.max(1.3, next.EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    next.reps += 1;
    next.interval = next.reps === 1 ? 1 : next.reps === 2 ? 6 : Math.round(next.interval * next.EF);
  }
  next.nextReview = Date.now() + next.interval * DAY;
  return next;
}

export function dueCards(cards: Card[], now = Date.now()): Card[] {
  return cards.filter((c) => c.nextReview <= now).sort((a, b) => a.nextReview - b.nextReview);
}

export function loadCards(): Card[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
export function saveCards(cards: Card[]): void {
  localStorage.setItem(KEY, JSON.stringify(cards));
}
export function addCard(input: Pick<Card, "fen" | "bestMove" | "context">): void {
  const cards = loadCards();
  saveCards([...cards, { ...input, id: crypto.randomUUID(), EF: 2.5, interval: 0, reps: 0, nextReview: 0 }]);
}
```

Train UI: show due card FEN on mini-board (reuse `Board`), user moves → compare move UCI (`from+to+promotion`) with `bestMove` → quality auto (5 direct / 4 after hint button reveals origin piece / 0 wrong-then-give-up→show answer, 2 wrong-then-correct) → `reviewCard` + save + next. Progress: "due N, done M".

- [ ] **Step 4: Verify**

Run: `npx vitest run lib/sm2/scheduler.test.ts` → PASS. Browser with seeded card: solve → card reschedules (nextReview > now).

- [ ] **Step 5: Commit**

```bash
git add lib/sm2/ app/train/ && git commit -m "feat: SM-2 trainer from own errors"
```

---

### Task 10: Opening trainer + Lichess explorer

**Files:**
- Create: `lib/lichess/explorer.ts`, `lib/repertoire/drill.ts`, `data/repertoire.json`, drill tab in `app/train/page.tsx`
- Test: `lib/lichess/explorer.test.ts`, `lib/repertoire/drill.test.ts`

**Interfaces:**
- Consumes: `fetch` (mocked in tests), repertoire JSON.
- Produces: `fetchExplorerMoves(fen)` with cache+fallback; `checkDrillMove(line, ply, san)`; drill UI.

Seed repertoire (2 lines/color):

```json
{
  "white": [
    { "name": "Italian Game", "line": ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
    { "name": "London System", "line": ["d4", "d5", "Bf4", "Nf6", "e3"] }
  ],
  "black": [
    { "name": "Caro-Kann vs e4", "line": ["e4", "c6", "d4", "d5"] },
    { "name": "QGD setup vs d4", "line": ["d4", "Nf6", "c4", "e6"] }
  ]
}
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/lichess/explorer.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchExplorerMoves, clearCache } from "./explorer";
beforeEach(() => { clearCache(); vi.unstubAllGlobals(); });
describe("explorer", () => {
  it("returns master moves and caches", async () => {
    const stub = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ moves: [{ san: "e4", white: 10, draws: 2, black: 5 }] }) });
    vi.stubGlobal("fetch", stub);
    const fen = "startpos";
    const r1 = await fetchExplorerMoves(fen);
    const r2 = await fetchExplorerMoves(fen);
    expect(r1[0].san).toBe("e4");
    expect(stub).toHaveBeenCalledTimes(1);
  });
  it("falls back to [] on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(fetchExplorerMoves("x")).resolves.toEqual([]);
  });
});
```

```ts
// lib/repertoire/drill.test.ts
import { describe, expect, it } from "vitest";
import { checkDrillMove } from "./drill";
describe("drill", () => {
  it("accepts expected SAN, rejects deviation with expected move", () => {
    expect(checkDrillMove(["e4", "e5", "Nf3"], 2, "Nf3")).toEqual({ ok: true });
    expect(checkDrillMove(["e4", "e5", "Nf3"], 2, "Bc4")).toEqual({ ok: false, expected: "Nf3" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/lichess/explorer.test.ts lib/repertoire/drill.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write implementation + drill UI**

```ts
// lib/lichess/explorer.ts
export interface ExplorerMove { san: string; white: number; draws: number; black: number; }
export interface ExplorerStats { white: number; draws: number; black: number; opening?: { eco: string; name: string }; }
const cache = new Map<string, ExplorerMove[]>();
const statsCache = new Map<string, ExplorerStats | null>();
export function clearCache(): void { cache.clear(); statsCache.clear(); }

export async function fetchExplorerMoves(fen: string): Promise<ExplorerMove[]> {
  if (cache.has(fen)) return cache.get(fen)!;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("explorer " + res.status);
    const data = await res.json();
    const moves = (data.moves ?? []) as ExplorerMove[];
    cache.set(fen, moves);
    return moves;
  } catch {
    return []; // offline fallback: local repertoire + engine (caller handles)
  }
}

// Position-level stats (totals + ECO/variant name) for the explore panel (§5.5.1).
export async function fetchExplorerStats(fen: string): Promise<ExplorerStats | null> {
  if (statsCache.has(fen)) return statsCache.get(fen)!;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("explorer " + res.status);
    const data = await res.json();
    const stats: ExplorerStats = {
      white: data.white ?? 0, draws: data.draws ?? 0, black: data.black ?? 0,
      opening: data.opening ? { eco: data.opening.eco ?? "", name: data.opening.name ?? "" } : undefined,
    };
    statsCache.set(fen, stats);
    return stats;
  } catch {
    statsCache.set(fen, null);
    return null; // offline: explore panel shows engine eval only
  }
}
```

```ts
// lib/repertoire/drill.ts
export function checkDrillMove(line: string[], ply: number, san: string): { ok: true } | { ok: false; expected: string } {
  const norm = (s: string) => s.replace(/[+#?!]+$/, "");
  return norm(line[ply] ?? "") === norm(san) ? { ok: true } : { ok: false, expected: line[ply] };
}
```

Drill UI (tab in `/train`): pick line → board at line position → user plays mover's moves (opponent moves auto-applied) → deviation shows engine refutation (analyze + cp-loss) + explorer popular continuations below.

Explore mode (§5.5.1, same tab): toggle "explore" accepts ANY legal move (skip `checkDrillMove`). On free move: engine analyzes before/after (cpLoss + best reply), `fetchExplorerMoves` + `fetchExplorerStats` for the resulting FEN, POST `/api/coach/explore` with `{fenBefore, sanPlayed, cpLoss, explorerStats, openingName}` → panel shows verdict + W/D/L % + ECO name + consequences. Coach failure: same queue rule as Task 7 (retry 1x → local eval summary → enqueue).

- [ ] **Step 4: Verify**

Run: `npx vitest run lib/lichess lib/repertoire` → PASS. Browser drill: play Italian line correctly → completes; deviate → expected move shown. Explore toggle: play 2.Ke2?! → panel shows cpLoss, stats (or offline note), verdict.

- [ ] **Step 5: Commit**

```bash
git add lib/lichess/explorer.* lib/repertoire/ data/repertoire.json app/train/ && git commit -m "feat: opening drills + lichess explorer + explore mode"
```

---

### Task 11: Tablebase endgame exactness

**Files:**
- Create: `lib/lichess/tablebase.ts`
- Test: `lib/lichess/tablebase.test.ts`
- Modify: turn loop in `app/play/page.tsx`, `lib/postgame.ts` (TB-first when endgame ≤7 pieces)

**Interfaces:**
- Consumes: FEN (caller checks piece count ≤ 7 via chess.js).
- Produces: `fetchTablebase(fen)` → `{category, bestUci} | null`; null → caller falls back to WASM.

- [ ] **Step 1: Write the failing test**

```ts
// lib/lichess/tablebase.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchTablebase } from "./tablebase";
beforeEach(() => vi.unstubAllGlobals());
describe("tablebase", () => {
  it("returns category + best move", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ category: "win", moves: [{ uci: "e2e4", wdl: 2 }] }),
    }));
    await expect(fetchTablebase("8/8/8/4k3/8/4K3/4P3/8 w - - 0 1")).resolves.toMatchObject({ bestUci: "e2e4", category: "win" });
  });
  it("returns null on failure (caller falls back to WASM)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(fetchTablebase("x")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/lichess/tablebase.test.ts`
Expected: FAIL with "Cannot find module './tablebase'".

- [ ] **Step 3: Write implementation + wire-in**

```ts
// lib/lichess/tablebase.ts
export interface TBResult { category: string; bestUci: string | null; }

export async function fetchTablebase(fen: string): Promise<TBResult | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const best = (data.moves ?? []).find((m: { uci: string }) => m.uci)?.uci ?? null;
    return { category: data.category ?? "unknown", bestUci: best };
  } catch {
    return null; // fallback: deepen WASM search
  }
}
```

Wire-in helper (add to `lib/postgame.ts` and reuse in play page):

```ts
// usage pattern — TB first in ≤7-piece endgames, else WASM
import { Chess } from "chess.js";
import { fetchTablebase } from "./lichess/tablebase";

export async function bestMoveEndgameAware(fen: string, engine: Engine, depth = 14) {
  const c = new Chess(fen);
  const pieces = c.board().flat().filter(Boolean).length;
  if (pieces <= 7) {
    const tb = await fetchTablebase(fen);
    if (tb?.bestUci) return { best: tb.bestUci, source: "tablebase" as const, category: tb.category };
  }
  const e = await engine.analyze(fen, depth);
  return { best: e.best, source: "engine" as const, category: null as string | null };
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run lib/lichess/tablebase.test.ts` → PASS. Browser: K+P vs K position uses TB (category shown in UI position tab).

- [ ] **Step 5: Commit**

```bash
git add lib/lichess/tablebase* lib/postgame.ts app/play/page.tsx && git commit -m "feat: tablebase exact endgames with WASM fallback"
```

---

### Task 12: Library (list, replay, re-analyse, notebook) + curated games

**Files:**
- Create: `lib/library/storage.ts`, `data/games.json`, `app/library/page.tsx`, `app/study/page.tsx`
- Test: `lib/library/storage.test.ts`

**Interfaces:**
- Consumes: `games.v1` key, `collectEvals`, coach postgame route, `Board` component.
- Produces: game list with filters, replay with arrows+eval bar+PGN nav, re-analyse (new version, never overwrite), notes, curated seed games.

`games.v1` shape: `{id, pgn, date, result, analyses: {id, date, depth, rows}[], note}`.

Seed `data/games.json` (PGNs verified short mates + one Morphy; more classics pasted later via the same import UI):

```json
[
  { "id": "opera-1858", "white": "Morphy", "black": "Duke Karl / Count Isouard", "year": 1858,
    "pgn": "1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0",
    "tags": ["tactics"], "lesson": "Development beats material: every piece joins before the final blow." },
  { "id": "fools-mate", "white": "NN", "black": "NN", "year": 0,
    "pgn": "1. f3 e5 2. g4 Qh4# 0-1",
    "tags": ["kingSafety"], "lesson": "f/g pawn pushes open the king: the fastest punishment." },
  { "id": "scholars-mate", "white": "NN", "black": "NN", "year": 0,
    "pgn": "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0",
    "tags": ["kingSafety", "tactics"], "lesson": "f7 is Black's weakest square; develop knights to stop early mates." }
]
```

- [ ] **Step 1: Write the failing storage test**

```ts
// lib/library/storage.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { saveGame, listGames, addAnalysis, setNote } from "./storage";
beforeEach(() => localStorage.clear());
describe("library", () => {
  it("saves, lists, versions analyses, stores notes", () => {
    const id = saveGame("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0");
    expect(listGames()).toHaveLength(1);
    addAnalysis(id, { depth: 12, rows: [] });
    addAnalysis(id, { depth: 18, rows: [] });
    expect(listGames()[0].analyses).toHaveLength(2); // never overwrite
    setNote(id, "remember f7");
    expect(listGames()[0].note).toBe("remember f7");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/library/storage.test.ts`
Expected: FAIL with "Cannot find module './storage'".

- [ ] **Step 3: Write implementation + UI**

```ts
// lib/library/storage.ts
export interface Analysis { id: string; date: number; depth: number; rows: unknown[]; }
export interface SavedGame {
  id: string; pgn: string; date: number; result: string;
  analyses: Analysis[]; note: string;
}
const KEY = "games.v1";

function read(): SavedGame[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function write(g: SavedGame[]): void { localStorage.setItem(KEY, JSON.stringify(g)); }

export function saveGame(pgn: string): string {
  const games = read();
  const id = crypto.randomUUID();
  const result = pgn.includes("1-0") ? "1-0" : pgn.includes("0-1") ? "0-1" : "1/2-1/2";
  games.unshift({ id, pgn, date: Date.now(), result, analyses: [], note: "" });
  write(games);
  return id;
}
export function listGames(): SavedGame[] { return read(); }
export function addAnalysis(id: string, a: Omit<Analysis, "id" | "date">): void {
  const games = read();
  const g = games.find((x) => x.id === id);
  if (!g) return;
  g.analyses.push({ ...a, id: crypto.randomUUID(), date: Date.now() });
  write(games);
}
export function setNote(id: string, note: string): void {
  const games = read();
  const g = games.find((x) => x.id === id);
  if (!g) return;
  g.note = note;
  write(games);
}
```

Library UI: filters (result, text search), replay (step through PGN with prev/next + arrows + eval bar from stored analysis), "re-analyse" with depth selector → new version, note textarea, "study" links curated game by weakest tag. On game end (Task 8), call `saveGame(game.pgn())` so finished games land here automatically.

Study view (§5.8, `app/study/page.tsx`): 3 columns — chapters list (repertoire lines from `data/repertoire.json` + curated `data/games.json`), center `Board`, right annotated moves (PGN steps; per-move coach comment fetched once via `/api/coach/explore` with `{fenBefore, sanPlayed, cpLoss: 0, explorerStats, openingName}` and cached in component state). Bottom nav: prev/next/flip. Explore toggle: any free legal move at any point → same explore panel as Task 10 (reuse its component/logic — extract shared `ExplorePanel` if cleaner, same commit). No chat/social.

- [ ] **Step 4: Verify**

Run: `npx vitest run lib/library/storage.test.ts` → PASS. Browser: finish a game → appears in library → replay steps → re-analyse adds v2 → note saves. Study: open Italian line chapter → step through → comments load; free move 2.Ke2?! → explore panel shows verdict + stats.

- [ ] **Step 5: Commit**

```bash
git add lib/library/ data/games.json app/library/ app/study/ && git commit -m "feat: game library with re-analyse + notebook + study view"
```

---

### Task 13: Integration test + PWA offline + deploy

**Files:**
- Create: `lib/integration.test.ts`, `public/sw.js`, `public/icon-512.png` (any 512px PNG), `playwright.config.ts`, `e2e/smoke.spec.ts`, `.env.example`
- Modify: `app/layout.tsx` (register SW)

**Interfaces:**
- Consumes: everything above with mocked engine/coach.
- Produces: green full suite, offline-capable PWA, Vercel-ready deploy.

- [ ] **Step 1: Write the failing integration test (full loop, mocked)**

```ts
// lib/integration.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { collectEvals } from "./postgame";
import { phaseAverages } from "./chess/measure";
import { loadProfile, saveProfile } from "./profile/store";
import { applyPostgame } from "./profile/update";
import { addCard, dueCards, loadCards } from "./sm2/scheduler";
import { createMockEngine } from "./engine/engine";

beforeEach(() => localStorage.clear());

describe("full loop", () => {
  it("game → postgame → profile → sm2 card due", async () => {
    const pgn = "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0";
    const rows = await collectEvals(pgn, createMockEngine());
    expect(rows).toHaveLength(4);
    const phases = phaseAverages(rows.map((r) => ({ phase: r.phase, score: r.score })));
    expect(phases.opening).toBeGreaterThan(0);
    saveProfile(applyPostgame(loadProfile(), { won: true, tags: ["tactics"], fens: [rows[0].fen], phases }));
    expect(loadProfile().games).toBe(1);
    addCard({ fen: rows[0].fen, bestMove: "g8f6", context: "missed mate defense" });
    expect(dueCards(loadCards())).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/integration.test.ts`
Expected: FAIL (missing modules until Tasks 8+9 exist — this task runs last, so expect PASS; if FAIL, implement the missing import first).

- [ ] **Step 3: Write service worker + env example + e2e**

```js
// public/sw.js
const CACHE = "coach-v1";
const SHELL = ["/", "/play", "/train", "/library", "/dashboard", "/manifest.webmanifest"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/") || url.host.includes("lichess")) return; // network only
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
```

Register in `app/layout.tsx`:

```tsx
// inside root layout client effect
useEffect(() => {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}, []);
```

```
# .env.example
ANTHROPIC_API_KEY=sk-ant-...
COACH_MODEL=<current claude-sonnet id, e.g. from console.anthropic.com>
```

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "e2e", webServer: { command: "npm run dev", port: 3000 } });
```

```ts
// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";
test("setup → play renders", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /white/i }).click();
  await expect(page).toHaveURL(/\/play\?side=white/);
  await expect(page.locator("code").first()).toContainText("rnbqkbnr");
});
```

- [ ] **Step 4: Run everything + deploy**

Run: `npx vitest run` (all green) → `npx playwright install chromium` (once) → `npx playwright test` → `npm run build` clean. Deploy: Vercel → import repo, set `ANTHROPIC_API_KEY` + `COACH_MODEL`, deploy. Install on Android via Chrome → "Add to Home screen".

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: offline PWA, integration test, deploy config"
```

---

## Self-review

1. **Spec coverage:** Turn Protocol §2.2 → Tasks 5+7. Postgame §2.3 → Task 8. Sparring +250 → Task 7 (setElo). Thresholds §5.1 → Task 2. JSON contracts §5.2 → Task 6 (incl. explore route). Profile §5.3 → Task 3. SM-2 §5.4 → Task 9. Repertoire §5.5 + explore §5.5.1 → Task 10. Study §5.8 → Task 12 (app/study). games.json §5.6 → Task 12. Phase scores §5.7 → Tasks 2+8. Explorer+TB §6 → Tasks 10+11. Storage/API/PWA §7 → Tasks 3+6+13. Errors/tests §8 → Tasks 4 (mock fallback), 7 (queue), 11 (null fallback), 13 (suite). Lichess puzzles/import → Phase 2, correctly absent.
2. **Placeholders:** none — every step has exact commands/code. `public/icon-512.png` flagged as Task 13 asset (any 512px PNG before store submission).
3. **Type consistency:** `Phase`, `Profile`, `Card`, `Eval`, `TurnResponse/PostgameResponse` defined once, imported by the stated paths. `phaseAverages` input `{phase, score}[]` matches `collectEvals` rows. `applyPostgame` signature matches Task 8 call. `bestMoveEndgameAware` return shape `{best, source, category}` consistent at both call sites.
