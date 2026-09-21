import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fetchMastersExplorer,
  fetchStandardTablebase,
  clearUpstreamCache,
} from "./upstream";

beforeEach(() => {
  clearUpstreamCache();
  vi.unstubAllGlobals();
});

describe("upstream cache", () => {
  it("caches masters explorer per fen with 1h TTL", async () => {
    const stub = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ white: 10, draws: 2, black: 5 }),
    });
    vi.stubGlobal("fetch", stub);
    const r1 = await fetchMastersExplorer("fen1");
    const r2 = await fetchMastersExplorer("fen1");
    expect(r1).toEqual({ white: 10, draws: 2, black: 5 });
    expect(r2).toEqual(r1);
    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub.mock.calls[0][0]).toContain("https://explorer.lichess.ovh/masters?fen=");
  });

  it("dedupes in-flight requests", async () => {
    let resolveJson!: (v: unknown) => void;
    const gate = new Promise<unknown>((res) => (resolveJson = res));
    const stub = vi.fn().mockResolvedValue({
      ok: true,
      json: () => gate,
    });
    vi.stubGlobal("fetch", stub);
    const p1 = fetchMastersExplorer("fen2");
    const p2 = fetchMastersExplorer("fen2");
    resolveJson({ white: 1 });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ white: 1 });
    expect(r2).toEqual({ white: 1 });
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("does not cache upstream failures", async () => {
    const stub = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", stub);
    await expect(fetchMastersExplorer("fen3")).resolves.toBeNull();
    await expect(fetchMastersExplorer("fen3")).resolves.toBeNull();
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it("caches tablebase separately from explorer", async () => {
    const stub = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ category: "win", moves: [{ uci: "e2e4" }] }),
    });
    vi.stubGlobal("fetch", stub);
    const tb = await fetchStandardTablebase("fen4");
    expect(tb).toMatchObject({ category: "win" });
    expect(stub.mock.calls[0][0]).toContain("https://tablebase.lichess.ovh/standard?fen=");
    await fetchStandardTablebase("fen4");
    expect(stub).toHaveBeenCalledTimes(1);
  });
});
