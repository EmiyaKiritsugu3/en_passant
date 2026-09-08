import { describe, expect, it, beforeEach } from "vitest";
import { loadProfile, saveProfile } from "./store";
import { applyPostgame } from "./update";

beforeEach(() => {
  window.localStorage.clear();
});

describe("store", () => {
  it("loads default rating 800 on empty storage", () => {
    expect(loadProfile().rating).toBe(800);
  });
  it("round-trips a profile", () => {
    const p = loadProfile(); p.games = 3; saveProfile(p);
    expect(loadProfile().games).toBe(3);
  });
  it("backs up before migrating unknown version", () => {
    window.localStorage.setItem("profile.v1", JSON.stringify({ version: 99 }));
    const p = loadProfile();
    expect(p.version).toBe(1);
    expect(window.localStorage.getItem("profile.v1.bak")).toContain("99");
  });
});

describe("applyPostgame", () => {
  it("bumps games, tags, rating on win and appends phase row", () => {
    const p = loadProfile();
    const next = applyPostgame(p, { won: true, tags: ["tactics", "tactics"], fens: ["f"], phases: { opening: 60, middlegame: 55, endgame: 40 } });
    expect(next.games).toBe(1);
    expect(next.errorTags.tactics).toBe(2);
    expect(next.rating).toBeGreaterThan(800);
    expect(next.phaseHistory).toHaveLength(1);
  });
});
