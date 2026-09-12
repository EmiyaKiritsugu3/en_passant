import { describe, expect, it } from "vitest";
import { addCard, loadCards, reviewCard, dueCards, summarizeDue, type Card } from "./scheduler";

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

  it("addCard dedups by fen, applies quality", () => {
    localStorage.clear();
    addCard({ fen: "f1", bestMove: "e2e4", context: "London System" });
    addCard({ fen: "f1", bestMove: "e2e4", context: "London System" });
    expect(loadCards()).toHaveLength(1);
    localStorage.clear();
    addCard({ fen: "f2", bestMove: "e2e4", context: "London System" }, 5);
    const [c] = loadCards();
    expect(c.reps).toBe(1);
    expect(c.nextReview).toBeGreaterThan(Date.now());
    localStorage.clear();
  });

  it("summarizeDue groups by context", () => {
    const s = summarizeDue(
      [card({ nextReview: 1, context: "London", reps: 0 }), card({ nextReview: 2, context: "London", reps: 2 }), card({ nextReview: 99, reps: 3 })],
      10
    );
    expect(s).toMatchObject({ total: 3, due: 2, fresh: 1 });
    expect(s.byContext).toEqual([{ context: "London", due: 2 }]);
  });
});
