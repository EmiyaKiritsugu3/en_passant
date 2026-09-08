import { describe, expect, it, beforeEach } from "vitest";
import { collectEvals } from "./postgame";
import { phaseAverages } from "./chess/measure";
import { loadProfile, saveProfile, applyPostgame } from "./profile/store";
import { addCard, dueCards, loadCards } from "./sm2/scheduler";
import { createMockEngine } from "./engine/engine";

beforeEach(() => localStorage.clear());

describe("full loop", () => {
  it("game → postgame → profile → sm2 card due", async () => {
    const pgn = "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0";
    const rows = await collectEvals(pgn, createMockEngine());
    expect(rows).toHaveLength(7);
    const phases = phaseAverages(rows.map((r) => ({ phase: r.phase, score: r.score })));
    expect(phases.opening).toBeGreaterThan(0);
    saveProfile(applyPostgame(loadProfile(), { won: true, tags: ["tactics"], fens: [rows[0].fen], phases }));
    expect(loadProfile().games).toBe(1);
    addCard({ fen: rows[0].fen, bestMove: "g8f6", context: "missed mate defense" });
    expect(dueCards(loadCards())).toHaveLength(1);
  });
});
