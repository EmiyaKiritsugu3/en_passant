import { describe, expect, it } from "vitest";
import { checkDrillMove } from "./drill";

describe("drill", () => {
  it("accepts expected SAN, rejects deviation with expected move", () => {
    expect(checkDrillMove(["e4", "e5", "Nf3"], 2, "Nf3")).toEqual({ ok: true });
    expect(checkDrillMove(["e4", "e5", "Nf3"], 2, "Bc4")).toEqual({ ok: false, expected: "Nf3" });
  });
});
