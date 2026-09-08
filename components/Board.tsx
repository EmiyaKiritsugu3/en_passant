"use client";

import { useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { DrawShape } from "chessground/draw";
import type { Dests, Key } from "chessground/types";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

function getLegalDests(fen: string): { dests: Dests; turnColor: "white" | "black" } {
  const dests: Dests = new Map();
  try {
    const chess = new Chess(fen);
    const turnColor = chess.turn() === "w" ? "white" : "black";
    for (const move of chess.moves({ verbose: true })) {
      const from = move.from as Key;
      const to = move.to as Key;
      const existing = dests.get(from);
      if (existing) {
        existing.push(to);
      } else {
        dests.set(from, [to]);
      }
    }
    return { dests, turnColor };
  } catch {
    return { dests, turnColor: "white" };
  }
}

export default function Board({
  fen,
  orientation,
  onMove,
  shape,
}: {
  fen: string;
  orientation: "white" | "black";
  onMove?: (from: string, to: string) => void;
  shape?: DrawShape[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!ref.current) return;
    const { dests, turnColor } = getLegalDests(fen);

    api.current = Chessground(ref.current, {
      fen,
      orientation,
      turnColor,
      movable: {
        free: false,
        color: onMove ? turnColor : undefined,
        dests: onMove ? dests : new Map(),
        showDests: true,
        events: {
          after: (orig, dest) => {
            onMoveRef.current?.(orig, dest);
          },
        },
      },
      drawable: {
        shapes: shape ?? [],
      },
    });

    return () => api.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!api.current) return;
    const { dests, turnColor } = getLegalDests(fen);

    api.current.set({
      fen,
      orientation,
      turnColor,
      movable: {
        color: onMove ? turnColor : undefined,
        dests: onMove ? dests : new Map(),
      },
      drawable: {
        shapes: shape ?? [],
      },
    });
  }, [fen, orientation, onMove, shape]);

  return <div ref={ref} style={{ width: "min(90vw, 560px)", aspectRatio: "1" }} />;
}

