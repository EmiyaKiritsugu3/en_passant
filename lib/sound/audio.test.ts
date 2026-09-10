import { describe, it, expect, beforeEach } from "vitest";
import {
  getAudioMuted,
  setAudioMuted,
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playGameEndSound,
} from "./audio";

describe("Procedural Audio Engine", () => {
  beforeEach(() => {
    localStorage.clear();
    setAudioMuted(false);
  });

  it("manages mute state and persists to localStorage", () => {
    expect(getAudioMuted()).toBe(false);
    setAudioMuted(true);
    expect(getAudioMuted()).toBe(true);
    expect(localStorage.getItem("chess_audio_muted")).toBe("true");

    setAudioMuted(false);
    expect(getAudioMuted()).toBe(false);
    expect(localStorage.getItem("chess_audio_muted")).toBe("false");
  });

  it("does not throw when triggering sounds while muted", () => {
    setAudioMuted(true);
    expect(() => playMoveSound()).not.toThrow();
    expect(() => playCaptureSound()).not.toThrow();
    expect(() => playCheckSound()).not.toThrow();
    expect(() => playGameEndSound()).not.toThrow();
  });

  it("handles sound execution gracefully in headless/mocked environment", () => {
    setAudioMuted(false);
    expect(() => playMoveSound()).not.toThrow();
    expect(() => playCaptureSound()).not.toThrow();
    expect(() => playCheckSound()).not.toThrow();
    expect(() => playGameEndSound()).not.toThrow();
  });
});
