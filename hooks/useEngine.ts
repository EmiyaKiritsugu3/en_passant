"use client";

import { useEffect, useRef, type DependencyList, type RefObject } from "react";
import { createMockEngine, createStockfishEngine, type Engine } from "@/lib/engine/engine";

// Shared engine lifecycle: Stockfish worker with mock fallback, quit on unmount.
// onReady runs after creation (e.g. schedule opponent first move); its cleanup
// runs before quit. Pass deps to recreate (play recreates when side changes).
export function useEngine(
  onReady?: (engine: Engine) => (() => void) | void,
  deps: DependencyList = []
): RefObject<Engine | null> {
  const ref = useRef<Engine | null>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    let engine: Engine;
    try {
      engine = createStockfishEngine();
    } catch {
      engine = createMockEngine();
    }
    ref.current = engine;
    const cleanup = onReadyRef.current?.(engine);
    return () => {
      try {
        cleanup?.();
      } finally {
        engine.quit();
        ref.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
