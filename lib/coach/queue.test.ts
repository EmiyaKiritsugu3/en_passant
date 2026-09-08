import { describe, expect, it, beforeEach } from "vitest";
import { enqueue, drain } from "./queue";

beforeEach(() => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});

describe("coach queue", () => {
  it("enqueues and drains FIFO", () => {
    enqueue({ fen: "a" });
    enqueue({ fen: "b" });
    expect(drain()).toEqual([{ fen: "a" }, { fen: "b" }]);
    expect(drain()).toEqual([]);
  });
});
