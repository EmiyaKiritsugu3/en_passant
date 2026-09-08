import { describe, expect, it } from "vitest";
import { TurnResponse, PostgameResponse, ExploreResponse, ChatResponse } from "./schemas";

describe("coach schemas", () => {
  it("accepts a valid turn response", () => {
    expect(() =>
      TurnResponse.parse({
        critique: "md",
        intent: "md",
        tags: ["tactics"],
        homework: "md",
      })
    ).not.toThrow();
  });

  it("rejects unknown tags", () => {
    expect(() =>
      TurnResponse.parse({
        critique: "a",
        intent: "b",
        tags: ["nope"],
        homework: "c",
      })
    ).toThrow();
  });

  it("accepts a valid postgame response", () => {
    expect(() =>
      PostgameResponse.parse({
        summary: "s",
        result: "1-0",
        moments: [{ move: 18, played: "Nf3?", best: "d5!", why: "w" }],
        takeaway: "t",
        homework: "h",
        profileDelta: {},
      })
    ).not.toThrow();
  });

  it("accepts a valid explore response", () => {
    expect(() =>
      ExploreResponse.parse({
        verdict: "dubious",
        consequences: "weakens kingside",
        namedVariant: "Sicilian Najdorf",
      })
    ).not.toThrow();
  });

  it("accepts a valid chat response", () => {
    expect(() => ChatResponse.parse({ reply: "Boa! E agora, qual o plano?" })).not.toThrow();
  });

  it("rejects empty chat reply", () => {
    expect(() => ChatResponse.parse({ reply: "" })).toThrow();
  });
});
