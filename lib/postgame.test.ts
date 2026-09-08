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
  });
});
