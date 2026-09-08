import { describe, expect, it, beforeEach } from "vitest";
import { loadChat, appendMessage, clearChat } from "./store";

beforeEach(() => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});

describe("chat store", () => {
  it("loadChat returns [] when empty", () => {
    expect(loadChat()).toEqual([]);
  });

  it("appends messages and caps at 50 messages", () => {
    for (let i = 0; i < 55; i++) {
      appendMessage({ role: "user", content: `msg ${i}` });
    }
    const msgs = loadChat();
    expect(msgs).toHaveLength(50);
    expect(msgs[0].content).toBe("msg 5");
    expect(msgs[49].content).toBe("msg 54");
  });

  it("clears chat history", () => {
    appendMessage({ role: "user", content: "hello" });
    clearChat();
    expect(loadChat()).toEqual([]);
  });
});
