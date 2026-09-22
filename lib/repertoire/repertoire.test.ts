import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import data from "../../data/repertoire.json";

interface Trap {
  name: string;
  mistake: string;
  setup: string[];
  solution: string[];
  punish: string;
  why: string;
}

interface Variation {
  name: string;
  line: string[];
  ideas?: string[];
  notes?: string[];
  traps?: Trap[];
}

function playAll(sans: string[]): Chess {
  const c = new Chess();
  for (const san of sans) c.move(san);
  return c;
}

describe("repertoire content", () => {
  const openings = [...data.white, ...data.black];

  it("has openings with eco and variations", () => {
    expect(openings.length).toBeGreaterThanOrEqual(8);
    for (const o of openings) {
      expect(o.eco).toMatch(/^[A-E]\d{2}$/);
      expect(o.variations.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("validates every main line: legal SANs, notes 1:1, ideas", () => {
    for (const o of openings) {
      for (const v of o.variations as Variation[]) {
        expect(v.line.length).toBeGreaterThanOrEqual(9);
        expect(v.notes?.length).toBe(v.line.length);
        expect(v.ideas?.length).toBeGreaterThanOrEqual(3);
        expect(() => playAll(v.line)).not.toThrow();
      }
    }
  });

  it("validates hunt traps: setup legal, solution alternates from setup turn", () => {
    for (const o of openings) {
      for (const v of o.variations as Variation[]) {
        expect(v.traps?.length).toBeGreaterThanOrEqual(1);
        for (const t of v.traps ?? []) {
          expect(t.setup.length).toBeGreaterThanOrEqual(6);
          expect(t.solution.length).toBeGreaterThanOrEqual(1);
          const c = playAll(t.setup);
          const userSide = c.turn();
          t.solution.forEach((san, i) => {
            expect(c.turn()).toBe(i % 2 === 0 ? userSide : userSide === "w" ? "b" : "w");
            c.move(san);
          });
        }
      }
    }
  });
});
