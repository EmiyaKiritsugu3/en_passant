import { describe, expect, it, beforeEach } from "vitest";
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
