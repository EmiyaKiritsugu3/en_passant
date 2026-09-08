import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchTablebase } from "./tablebase";

beforeEach(() => vi.unstubAllGlobals());

describe("tablebase", () => {
  it("returns category + best move", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ category: "win", moves: [{ uci: "e2e4", wdl: 2 }] }),
      })
    );
    await expect(
      fetchTablebase("8/8/8/4k3/8/4K3/4P3/8 w - - 0 1")
    ).resolves.toMatchObject({ bestUci: "e2e4", category: "win" });
  });

  it("returns null on failure (caller falls back to WASM)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(fetchTablebase("x")).resolves.toBeNull();
  });
});
