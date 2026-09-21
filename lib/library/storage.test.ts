import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { saveGame, listGames, addAnalysis, setNote } from "./storage";

beforeEach(() => localStorage.clear());

describe("library", () => {
  it("saves, lists, versions analyses, stores notes", () => {
    const id = saveGame("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0");
    expect(listGames()).toHaveLength(1);
    addAnalysis(id, { depth: 12, rows: [] });
    addAnalysis(id, { depth: 18, rows: [] });
    expect(listGames()[0].analyses).toHaveLength(2); // never overwrite
    setNote(id, "remember f7");
    expect(listGames()[0].note).toBe("remember f7");
  });
});

describe("library indexeddb", () => {
  const instances: Array<{ clearMemoryCache: () => Promise<void> }> = [];

  beforeEach(async () => {
    for (const m of instances) await m.clearMemoryCache();
    instances.length = 0;
    vi.resetModules();
    localStorage.clear();
    const { indexedDB } = await import("fake-indexeddb");
    vi.stubGlobal("indexedDB", indexedDB);
    await new Promise<void>((res, rej) => {
      const r = indexedDB.deleteDatabase("chess-coach");
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates legacy localStorage into IDB and clears the key", async () => {
    localStorage.setItem(
      "games.v1",
      JSON.stringify([{ id: "g1", pgn: "1. e4 1-0", date: 1, result: "1-0", analyses: [], note: "" }])
    );
    const mod = await import("./storage");
    instances.push(mod);
    await mod.hydrateGames();
    expect(mod.listGames()).toHaveLength(1);
    expect(mod.listGames()[0].id).toBe("g1");
    expect(localStorage.getItem("games.v1")).toBeNull();
  });

  it("persists writes to IDB across a simulated reload", async () => {
    const mod = await import("./storage");
    instances.push(mod);
    await mod.hydrateGames();
    const id = mod.saveGame("1. e4 e5 1/2-1/2");
    mod.setNote(id, "hello");
    await new Promise((r) => setTimeout(r, 50)); // flush async persist
    await mod.clearMemoryCache();
    await mod.hydrateGames();
    expect(mod.listGames()).toHaveLength(1);
    expect(mod.listGames()[0].note).toBe("hello");
    expect(localStorage.getItem("games.v1")).toBeNull();
  });
});
