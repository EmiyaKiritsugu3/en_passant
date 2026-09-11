import { describe, expect, it } from "vitest";
import { accepts, hintText, qualityFor, reduce, type LadderStage } from "./ladder";
import { londonDrills } from "./london";

const drill = londonDrills[0];

describe("ladder", () => {
  it("spot skips hints, miss enters ladder", () => {
    expect(reduce({ kind: "recognize" }, { type: "SPOT" })).toEqual({ kind: "execute" });
    expect(reduce({ kind: "recognize" }, { type: "MISS" })).toEqual({ kind: "hint", level: 1 });
  });

  it("hints climb to 4 then hold, correct advances", () => {
    let s: LadderStage = { kind: "hint", level: 1 };
    for (const l of [2, 3, 4, 4] as const) {
      s = reduce(s, { type: "HINT" });
      expect(s).toEqual({ kind: "hint", level: l });
    }
    expect(reduce(s, { type: "CORRECT" })).toEqual({ kind: "execute" });
    expect(reduce({ kind: "hint", level: 2 }, { type: "REVEAL" })).toEqual({
      kind: "done", solved: false, quality: 0,
    });
  });

  it("execute: correct solves, wrong drops back to hint 1", () => {
    expect(reduce({ kind: "execute" }, { type: "CORRECT" })).toEqual({
      kind: "done", solved: true, quality: 5,
    });
    expect(reduce({ kind: "execute" }, { type: "WRONG" })).toEqual({ kind: "hint", level: 1 });
  });

  it("accepts ideal + secondary, case/+ insensitive", () => {
    expect(accepts(drill, drill.idealResponseSan)).toBe(true);
    expect(accepts(drill, drill.secondaryResponses[0])).toBe(true);
    expect(accepts(drill, "Bxh7+")).toBe(false);
  });

  it("quality maps attempts/hints, hint text by level", () => {
    const done = { kind: "done", solved: true, quality: 5 } as const;
    expect(qualityFor(done, 0, 0)).toBe(5);
    expect(qualityFor(done, 0, 2)).toBe(4);
    expect(qualityFor(done, 1, 0)).toBe(2);
    expect(qualityFor({ kind: "done", solved: false, quality: 0 }, 0, 0)).toBe(0);
    expect(hintText(drill, 1)).toBe(drill.hintLevel1);
    expect(hintText(drill, 4)).toBe(drill.hintLevel4);
  });
});
