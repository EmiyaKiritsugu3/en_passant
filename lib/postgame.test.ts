import { describe, expect, it } from "vitest";
import { collectEvals } from "./postgame";
import { createMockEngine } from "./engine/engine";

describe("collectEvals", () => {
  it("scores a 4-ply mate game with opening phases", async () => {
    const rows = await collectEvals("1. f3 e5 2. g4 Qh4# 0-1", createMockEngine());
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ phase: "opening" });
    expect(rows.every((r) => typeof r.score === "number")).toBe(true);
  });

  it("scores Scholar's mate (7 plies)", async () => {
    const rows = await collectEvals("1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0", createMockEngine());
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ phase: "opening" });
    expect(rows[0].fenBefore).toBeDefined();
    expect(rows[0].fenAfter).toBeDefined();
    expect(rows[0].fenBefore).not.toEqual(rows[0].fenAfter);
    // Move 1 (e4) played from startpos: fenBefore must have white turn
    expect(rows[0].fenBefore).toContain(" w ");
    expect(rows[0].fenAfter).toContain(" b ");
    // Move 2 (e5) played by Black: fenBefore has black turn, fenAfter has white turn
    expect(rows[1].fenBefore).toContain(" b ");
    expect(rows[1].fenAfter).toContain(" w ");
  });

  it("calculates non-inverted centipawn loss for book opening move", async () => {
    const rows = await collectEvals("1. e4 e5 1-0", createMockEngine());
    expect(rows).toHaveLength(2);
    // Both 1. e4 and 1... e5 are standard moves; cpLoss should not be inflated into massive blunder
    expect(rows[0].cpLoss).toBeLessThan(50);
    expect(rows[1].cpLoss).toBeLessThan(50);
  });
});
