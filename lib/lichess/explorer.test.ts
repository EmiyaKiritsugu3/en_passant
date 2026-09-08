import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchExplorerMoves, clearCache } from "./explorer";

beforeEach(() => {
  clearCache();
  vi.unstubAllGlobals();
});

describe("explorer", () => {
  it("returns master moves and caches", async () => {
    const stub = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        moves: [{ san: "e4", white: 10, draws: 2, black: 5 }],
      }),
    });
    vi.stubGlobal("fetch", stub);
    const fen = "startpos";
    const r1 = await fetchExplorerMoves(fen);
    const r2 = await fetchExplorerMoves(fen);
    expect(r1[0].san).toBe("e4");
    expect(r2).toEqual(r1);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("falls back to [] on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(fetchExplorerMoves("x")).resolves.toEqual([]);
  });
});
