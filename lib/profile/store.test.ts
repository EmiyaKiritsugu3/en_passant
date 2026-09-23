import { describe, expect, it, beforeEach } from "vitest";
import { loadProfile, saveProfile } from "./store";
import { applyPostgame, isStreakActive, streakLabel, touchStreak } from "./update";

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
  it("defaults streak for pre-streak profiles", () => {
    window.localStorage.setItem(
      "profile.v1",
      JSON.stringify({ version: 1, rating: 800, games: 2, openings: { "Italian Game": 1 } })
    );
    expect(loadProfile().streak).toEqual({ count: 0, lastDay: "" });
  });
  it("recovers from malformed streak and openings shapes", () => {
    window.localStorage.setItem(
      "profile.v1",
      JSON.stringify({ version: 1, streak: { count: "3" }, openings: null })
    );
    const p = loadProfile();
    expect(p.streak).toEqual({ count: 0, lastDay: "" });
    expect(p.openings).toEqual({});
  });
  it("drops non-numeric opening counts", () => {
    window.localStorage.setItem(
      "profile.v1",
      JSON.stringify({ version: 1, openings: { "Italian Game": 2, "Ruy Lopez": "bad", "London System": null } })
    );
    expect(loadProfile().openings).toEqual({ "Italian Game": 2 });
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
  it("starts the streak on the first completed game", () => {
    const p = loadProfile();
    const next = applyPostgame(p, { won: false, tags: [], fens: [], phases: { opening: 50, middlegame: 50, endgame: 50 } }, "2026-09-23");
    expect(next.streak).toEqual({ count: 1, lastDay: "2026-09-23" });
  });
});

describe("touchStreak", () => {
  it("starts at 1 on the first active day", () => {
    const next = touchStreak(loadProfile(), "2026-09-23");
    expect(next.streak).toEqual({ count: 1, lastDay: "2026-09-23" });
  });
  it("keeps the count when touching twice on the same day", () => {
    const once = touchStreak(loadProfile(), "2026-09-23");
    const twice = touchStreak(once, "2026-09-23");
    expect(twice.streak).toEqual({ count: 1, lastDay: "2026-09-23" });
  });
  it("increments on the next consecutive day", () => {
    const once = touchStreak(loadProfile(), "2026-09-22");
    const next = touchStreak(once, "2026-09-23");
    expect(next.streak).toEqual({ count: 2, lastDay: "2026-09-23" });
  });
  it("resets to 1 after a missed day", () => {
    const once = touchStreak(loadProfile(), "2026-09-20");
    const next = touchStreak(once, "2026-09-23");
    expect(next.streak).toEqual({ count: 1, lastDay: "2026-09-23" });
  });
  it("recovers from a malformed lastDay", () => {
    const p = loadProfile();
    p.streak.lastDay = "not-a-date";
    const next = touchStreak(p, "2026-09-23");
    expect(next.streak).toEqual({ count: 1, lastDay: "2026-09-23" });
  });
  it("increments across a month boundary", () => {
    const once = touchStreak(loadProfile(), "2026-12-31");
    const next = touchStreak(once, "2027-01-01");
    expect(next.streak).toEqual({ count: 2, lastDay: "2027-01-01" });
  });
});

describe("isStreakActive", () => {
  it("is active today and yesterday, expired before that", () => {
    expect(isStreakActive("2026-09-23", "2026-09-23")).toBe(true);
    expect(isStreakActive("2026-09-22", "2026-09-23")).toBe(true);
    expect(isStreakActive("2026-09-21", "2026-09-23")).toBe(false);
    expect(isStreakActive("", "2026-09-23")).toBe(false);
  });
});

describe("streakLabel", () => {
  it("uses singular for day one", () => {
    expect(streakLabel(1)).toBe("1 dia seguido");
    expect(streakLabel(4)).toBe("4 dias seguidos");
  });
});
