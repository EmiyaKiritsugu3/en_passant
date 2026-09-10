import { describe, it, expect } from "vitest";
import { calculateEvalPercentage, formatEvalScore } from "./evalbar";

describe("EvalBar calculations", () => {
  describe("formatEvalScore", () => {
    it("formats 0 as 0.0", () => {
      expect(formatEvalScore(0, null)).toBe("0.0");
    });

    it("formats positive centipawns with plus sign and decimal", () => {
      expect(formatEvalScore(140, null)).toBe("+1.4");
      expect(formatEvalScore(45, null)).toBe("+0.5");
    });

    it("formats negative centipawns with minus sign", () => {
      expect(formatEvalScore(-80, null)).toBe("-0.8");
    });

    it("formats mate scores with M prefix", () => {
      expect(formatEvalScore(0, 2)).toBe("M2");
      expect(formatEvalScore(0, -3)).toBe("-M3");
    });
  });

  describe("calculateEvalPercentage", () => {
    it("returns 50% for equal position", () => {
      const pct = calculateEvalPercentage(0, null, "white");
      expect(pct).toBe(50);
    });

    it("returns higher percentage for White advantage in White orientation", () => {
      const pctWhite = calculateEvalPercentage(400, null, "white");
      expect(pctWhite).toBeGreaterThan(80);
      expect(pctWhite).toBeLessThan(95);

      // In Black orientation, White advantage is at the top, meaning smaller bottom percentage
      const pctBlack = calculateEvalPercentage(400, null, "black");
      expect(pctBlack).toBeCloseTo(100 - pctWhite, 1);
    });

    it("handles forced mates correctly", () => {
      // White has mate in 2
      expect(calculateEvalPercentage(100000, 2, "white")).toBe(100);
      expect(calculateEvalPercentage(100000, 2, "black")).toBe(0);

      // Black has mate in 1
      expect(calculateEvalPercentage(-100000, -1, "white")).toBe(0);
      expect(calculateEvalPercentage(-100000, -1, "black")).toBe(100);
    });

    it("clamps percentages between 4% and 96% for non-mate scores so text is always visible", () => {
      const hugeAdvantage = calculateEvalPercentage(5000, null, "white");
      expect(hugeAdvantage).toBeLessThanOrEqual(96);
      expect(hugeAdvantage).toBeGreaterThanOrEqual(4);

      const hugeDeficit = calculateEvalPercentage(-5000, null, "white");
      expect(hugeDeficit).toBeGreaterThanOrEqual(4);
      expect(hugeDeficit).toBeLessThanOrEqual(96);
    });
  });
});
