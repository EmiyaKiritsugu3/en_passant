import { describe, expect, it } from "vitest";
import { createMockEngine, parseUciInfo } from "./engine";

describe("mock engine", () => {
  it("returns e2e4 as best in startpos and echoes setElo", async () => {
    const e = createMockEngine();
    await e.setElo(1050);
    const r = await e.analyze("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(r.best).toBe("e2e4");
    expect(typeof r.cp).toBe("number");
    e.quit();
  });
});

describe("parseUciInfo", () => {
  it("parses cp score and bestmove", () => {
    expect(parseUciInfo("info depth 12 score cp 35 nodes 1", "bestmove e2e4")).toEqual({ cp: 35, mate: null, best: "e2e4" });
    expect(parseUciInfo("info depth 12 score mate 3 nodes 1", "bestmove f7f8q")).toEqual({ cp: 100000, mate: 3, best: "f7f8q" });
  });
});
