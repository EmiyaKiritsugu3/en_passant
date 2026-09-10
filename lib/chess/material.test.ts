import { describe, it, expect } from "vitest";
import { calculateMaterial } from "./material";

describe("calculateMaterial", () => {
  it("calculates starting position with no captured pieces and zero advantage", () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const res = calculateMaterial(startFen);
    expect(res.whiteCaptured).toEqual([]);
    expect(res.blackCaptured).toEqual([]);
    expect(res.whiteAdvantage).toBe(0);
    expect(res.blackAdvantage).toBe(0);
  });

  it("calculates captures and material difference correctly when Black loses a pawn", () => {
    // 1. e4 d5 2. exd5 (Black lost d-pawn)
    const fen = "rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
    const res = calculateMaterial(fen);
    expect(res.whiteCaptured).toEqual(["p"]);
    expect(res.blackCaptured).toEqual([]);
    expect(res.whiteAdvantage).toBe(1);
    expect(res.blackAdvantage).toBe(0);
  });

  it("calculates captures correctly when both sides lose pieces", () => {
    // White lost queen and bishop, Black lost queen and knight
    // White lost: q (9) + b (3) = 12
    // Black lost: q (9) + n (3) = 12
    // Material diff: 0
    const fen = "rnb1k1nr/pppppppp/8/8/8/8/PPPPPPPP/RN2KBNR w KQkq - 0 1";
    const res = calculateMaterial(fen);
    // Black captured White's queen and bishop
    expect(res.blackCaptured.sort()).toEqual(["b", "q"]);
    // White captured Black's queen and bishop
    expect(res.whiteCaptured.sort()).toEqual(["b", "q"]);
    expect(res.whiteAdvantage).toBe(0);
    expect(res.blackAdvantage).toBe(0);
  });

  it("does not count a promoted pawn as captured", () => {
    // White pawn promoted to queen on a8 (7 pawns + 2 queens), Black lost a-rook
    const fen = "Qnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQk - 0 1";
    const res = calculateMaterial(fen);
    expect(res.whiteCaptured).toEqual(["r"]);
    expect(res.blackCaptured).toEqual([]);
    expect(res.whiteAdvantage).toBe(13);
    expect(res.blackAdvantage).toBe(0);
  });

  it("calculates piece values for knight vs bishop advantage", () => {
    // White lost knight (3), Black lost rook (5) -> White has +2
    const fen = "1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQk - 0 1";
    const res = calculateMaterial(fen);
    expect(res.whiteCaptured).toEqual(["r"]);
    expect(res.blackCaptured).toEqual(["n"]);
    expect(res.whiteAdvantage).toBe(2);
    expect(res.blackAdvantage).toBe(0);
  });
});
