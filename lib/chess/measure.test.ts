import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { classifyMove, detectPhase, moveScore, phaseAverages } from "./measure";

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

describe("phaseAverages", () => {
  it("computes average scores per phase", () => {
    const scored = [
      { phase: "opening" as const, score: 90 },
      { phase: "opening" as const, score: 80 },
      { phase: "middlegame" as const, score: 70 },
    ];
    expect(phaseAverages(scored)).toEqual({
      opening: 85,
      middlegame: 70,
      endgame: 0,
    });
  });
});
