import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { generateMoveAnalysis } from "./analysis";
import { TurnResponse } from "./schemas";

describe("generateMoveAnalysis", () => {
  it("analyzes 1. d4 with square control and diagonal opening", () => {
    const g = new Chess();
    const fenBefore = g.fen();
    const m = g.move("d4");
    const fenAfter = g.fen();

    const result = generateMoveAnalysis({
      fenBefore,
      fenAfter,
      san: m.san,
      from: m.from,
      to: m.to,
      piece: m.piece,
      moveLabel: "best",
      phase: "opening",
    });

    // Validates with TurnResponse schema
    expect(() => TurnResponse.parse(result)).not.toThrow();

    // Contains tactical commentary on d4, center control and diagonals
    expect(result.critique).toContain("d4");
    expect(result.critique).toContain("Melhor lance");
    expect(result.critique).toMatch(/c5.*e5|e5.*c5/);
    expect(result.critique).toContain("c1-h6");
    expect(result.tags).toContain("pawns");
    expect(result.intent).toBeTruthy();
    expect(result.homework).toBeTruthy();
  });

  it("analyzes 2. Nf3 detecting attack on enemy pawn at e5", () => {
    const g = new Chess();
    g.move("e4");
    g.move("e5");
    const fenBefore = g.fen();
    const m = g.move("Nf3");
    const fenAfter = g.fen();

    const result = generateMoveAnalysis({
      fenBefore,
      fenAfter,
      san: m.san,
      from: m.from,
      to: m.to,
      piece: m.piece,
      moveLabel: "great",
      phase: "opening",
    });

    expect(() => TurnResponse.parse(result)).not.toThrow();
    expect(result.critique).toContain("Cavalo");
    expect(result.critique).toContain("f3");
    expect(result.critique).toContain("e5");
    expect(result.tags).toContain("tactics");
  });

  it("analyzes kingside castling O-O", () => {
    // Setup position where White can castle
    const g = new Chess("r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4");
    const fenBefore = g.fen();
    const m = g.move("O-O");
    const fenAfter = g.fen();

    const result = generateMoveAnalysis({
      fenBefore,
      fenAfter,
      san: m.san,
      from: m.from,
      to: m.to,
      piece: m.piece,
      moveLabel: "good",
      phase: "opening",
    });

    expect(() => TurnResponse.parse(result)).not.toThrow();
    expect(result.critique).toContain("Roque");
    expect(result.tags).toContain("kingSafety");
  });

  it("analyzes tactical blunder with cpLoss and bestMove", () => {
    const g = new Chess();
    const fenBefore = g.fen();
    const m = g.move("g4");
    const fenAfter = g.fen();

    const result = generateMoveAnalysis({
      fenBefore,
      fenAfter,
      san: m.san,
      from: m.from,
      to: m.to,
      piece: m.piece,
      moveLabel: "blunder",
      cpLoss: 215,
      bestMove: "e4",
      phase: "opening",
    });

    expect(() => TurnResponse.parse(result)).not.toThrow();
    expect(result.critique).toContain("Erro grave");
    expect(result.critique).toContain("e4");
    expect(result.critique).toContain("2.1 pontos");
    expect(result.tags).toContain("tactics");
  });

  it("analyzes pawn fork / double attack", () => {
    // White pawn moves d2 to d4, forking black bishop on c5 and black knight on e5
    const g = new Chess("r1bqkbnr/pppp1ppp/8/2b1n3/8/4P3/PPPP1PPP/RNBQKBNR w KQkq - 0 1");
    const fenBefore = g.fen();
    const m = g.move("d4");
    const fenAfter = g.fen();

    const result = generateMoveAnalysis({
      fenBefore,
      fenAfter,
      san: m.san,
      from: m.from,
      to: m.to,
      piece: m.piece,
      moveLabel: "brilliant",
      phase: "middlegame",
    });

    expect(() => TurnResponse.parse(result)).not.toThrow();
    expect(result.critique).toContain("Ataque Duplo / Garfo");
    expect(result.critique).toContain("c5");
    expect(result.critique).toContain("e5");
  });

  it("analyzes move played by Black (...Nf6) without treating own pieces as opponent targets", () => {
    const g = new Chess();
    g.move("e4");
    g.move("e5");
    g.move("d4");
    const fenBefore = g.fen();
    const m = g.move("Nf6");
    const fenAfter = g.fen();

    const result = generateMoveAnalysis({
      fenBefore,
      fenAfter,
      san: m.san,
      from: m.from,
      to: m.to,
      piece: m.piece,
      color: "b",
      moveLabel: "good",
      phase: "opening",
    });

    expect(() => TurnResponse.parse(result)).not.toThrow();
    expect(result.critique).not.toContain("Rei em **e8**");
    expect(result.critique).not.toContain("Peão em **d7** e Rei");
    expect(result.critique).not.toContain("Garfo");
    expect(result.critique).toContain("e4");
    expect(result.critique).toContain("d7");
  });
});
