import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { getDrill, londonDrills } from "./london";

const norm = (s: string) => s.replace(/[+#?!]+$/, "");

describe("london punishment dataset", () => {
  it("has 5 drills", () => {
    expect(londonDrills.length).toBe(5);
  });

  it("stem + blunder replay to fenBlunder, ideal + secondary legal", () => {
    for (const d of londonDrills) {
      const c = new Chess();
      for (const san of [...d.stemMoves, d.opponentMistakeSan]) c.move(san);
      expect(c.fen(), d.id).toBe(d.fenBlunder);
      expect(() => new Chess(d.fenBlunder).move(d.idealResponseSan), d.id).not.toThrow();
      expect(
        new Chess(d.fenBlunder).moves().map(norm),
        d.id
      ).toContain(norm(d.idealResponseSan));
      for (const s of d.secondaryResponses) {
        expect(() => new Chess(d.fenBlunder).move(s), `${d.id}:${s}`).not.toThrow();
      }
      expect(getDrill(d.id)?.fenBeforeBlunder).toBeTruthy();
    }
  });
});
