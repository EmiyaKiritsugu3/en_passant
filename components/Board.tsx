"use client";

import { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { DrawShape } from "chessground/draw";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

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

  useEffect(() => {
    if (!ref.current) return;
    api.current = Chessground(ref.current, {
      movable: onMove ? { free: false, events: { after: onMove } } : { free: false },
    });
    return () => api.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.set({ fen, orientation, drawable: { shapes: shape ?? [] } });
  }, [fen, orientation, shape]);

  return <div ref={ref} style={{ width: "min(90vw, 560px)", aspectRatio: "1" }} />;
}
