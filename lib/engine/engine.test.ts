import { describe, expect, it } from "vitest";
import { createMockEngine, parseUciDepth, parseUciInfo, STOCKFISH_FILE, turnOfFen } from "./engine";

describe("mock engine", () => {
  it("returns e2e4 as best in startpos and echoes setElo", async () => {
    const e = createMockEngine();
    await e.setElo(1050);
    const r = await e.analyze("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(r.best).toBe("e2e4");
    expect(typeof r.cp).toBe("number");
    e.quit();
  });

  it("marks results as fallback so UI never labels them GM", async () => {
    const e = createMockEngine();
    const r = await e.analyze("2k5/2p2b1p/1p3p2/p5p1/P1p5/5NP1/1PP2PPK/3r4 w - - 0 27");
    expect(r.fallback).toBe(true);
    expect(r.best).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    e.quit();
  });
});

describe("parseUciInfo", () => {
  it("parses cp score and bestmove", () => {
    expect(parseUciInfo("info depth 12 score cp 35 nodes 1", "bestmove e2e4")).toEqual({ cp: 35, mate: null, best: "e2e4" });
    expect(parseUciInfo("info depth 12 score mate 3 nodes 1", "bestmove f7f8q")).toEqual({ cp: 100000, mate: 3, best: "f7f8q" });
  });
});

describe("progressive analysis", () => {
  it("extracts depth from info lines", () => {
    expect(parseUciDepth("info depth 12 seldepth 20 score cp 35 nodes 1000")).toBe(12);
    expect(parseUciDepth("bestmove e2e4")).toBeNull();
    expect(parseUciDepth("info string Classical (2048 MB)")).toBeNull();
  });

  it("points the worker at the copy-stockfish build", () => {
    expect(STOCKFISH_FILE).toMatch(/^stockfish-\d+-lite-single\.js$/);
  });

  it("stamps the side to move (UCI scores are relative to it)", async () => {
    expect(turnOfFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe("w");
    expect(turnOfFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).toBe("b");
    const e = createMockEngine();
    const r = await e.analyze("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect(r.turn).toBe("b");
    e.quit();
  });
});
