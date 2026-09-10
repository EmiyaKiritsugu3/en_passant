"use client";

import { useMemo } from "react";

interface PlayerCardProps {
  name: string;
  badge?: string;
  rating?: number;
  color: "white" | "black";
  isTurn: boolean;
  capturedPieces: string[];
  materialAdvantage: number;
  isThinking?: boolean;
  isEngine?: boolean;
}

const PIECE_GLYPHS: Record<string, { white: string; black: string }> = {
  p: { white: "♙", black: "♟" },
  n: { white: "♘", black: "♞" },
  b: { white: "♗", black: "♝" },
  r: { white: "♖", black: "♜" },
  q: { white: "♕", black: "♛" },
};

export default function PlayerCard({
  name,
  badge,
  rating,
  color,
  isTurn,
  capturedPieces,
  materialAdvantage,
  isThinking = false,
  isEngine = false,
}: PlayerCardProps) {
  // Sort captured pieces by value: pawns first, then knights, bishops, rooks, queen
  const sortedPieces = useMemo(() => {
    const order: Record<string, number> = { p: 1, n: 2, b: 3, r: 4, q: 5 };
    return [...capturedPieces].sort((a, b) => (order[a] || 0) - (order[b] || 0));
  }, [capturedPieces]);

  // Which glyph color should we show?
  // If player is White, the pieces they captured are Black pieces.
  // If player is Black, the pieces they captured are White pieces.
  const capturedColor = color === "white" ? "black" : "white";

  return (
    <div
      className={`w-full flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border transition-all duration-300 select-none ${
        isTurn
          ? "bg-zinc-900/90 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.12)]"
          : "bg-zinc-900/50 border-zinc-800/80"
      }`}
    >
      {/* Left: Avatar, Name, Rating */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md transition-all ${
              isEngine
                ? "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100"
                : "bg-gradient-to-br from-zinc-700 to-zinc-900 text-zinc-200 border border-zinc-700"
            } ${
              isTurn
                ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-950"
                : ""
            }`}
          >
            {isEngine ? "🤖" : "👤"}
          </div>

          {/* Color Indicator Dot */}
          <span
            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 shadow-sm ${
              color === "white" ? "bg-zinc-100" : "bg-zinc-900 border-zinc-700"
            }`}
            title={`Jogando de ${color === "white" ? "Brancas" : "Pretas"}`}
          />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold tracking-tight text-white line-clamp-1">
              {name}
            </span>
            {badge && (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {badge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {rating !== undefined && (
              <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-0.5">
                <span className="text-amber-500">★</span> {rating}
              </span>
            )}
            {isThinking && (
              <span className="text-[10px] font-mono text-amber-400 animate-pulse">
                • pensando...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Captured Pieces & Material Balance */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Pieces Row */}
        <div className="flex items-center text-sm sm:text-base leading-none text-zinc-300 font-serif tracking-tighter">
          {sortedPieces.map((p, idx) => (
            <span
              key={idx}
              className={`inline-block -ml-1 first:ml-0 drop-shadow-sm ${
                capturedColor === "white" ? "text-zinc-100" : "text-zinc-400"
              }`}
            >
              {PIECE_GLYPHS[p]?.[capturedColor] || p}
            </span>
          ))}
        </div>

        {/* Material Advantage Badge */}
        {materialAdvantage > 0 && (
          <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm animate-in fade-in">
            +{materialAdvantage}
          </span>
        )}
      </div>
    </div>
  );
}
