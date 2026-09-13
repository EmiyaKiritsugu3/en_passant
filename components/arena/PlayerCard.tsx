"use client";

import { useMemo } from "react";
import {
  Bot,
  ChessBishop,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Star,
  User,
} from "lucide-react";

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

const PIECE_ICONS: Record<string, typeof ChessPawn> = {
  p: ChessPawn,
  n: ChessKnight,
  b: ChessBishop,
  r: ChessRook,
  q: ChessQueen,
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
          ? "bg-noir-surface/90 border-bronze/40 shadow-[0_0_15px_rgba(180,140,60,0.12)]"
          : "bg-noir-surface/50 border-noir-line"
      }`}
    >
      {/* Left: Avatar, Name, Rating */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md transition-all ${
              isEngine
                ? "bg-gradient-to-br from-bronze-deep to-bronze text-noir-ink"
                : "bg-gradient-to-br from-noir-raised to-noir-surface text-noir-ink border border-noir-line"
            } ${
              isTurn
                ? "ring-2 ring-bronze ring-offset-2 ring-offset-noir-bg"
                : ""
            }`}
          >
            {isEngine ? <Bot size={16} /> : <User size={16} />}
          </div>

          {/* Color Indicator Dot */}
          <span
            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-noir-bg shadow-sm ${
              color === "white" ? "bg-noir-ink" : "bg-noir-surface border-noir-line"
            }`}
            title={`Jogando de ${color === "white" ? "Brancas" : "Pretas"}`}
          />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold tracking-tight text-noir-ink line-clamp-1">
              {name}
            </span>
            {badge && (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-bronze/15 text-bronze border border-bronze/30">
                {badge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {rating !== undefined && (
              <span className="text-[11px] font-mono text-noir-muted flex items-center gap-0.5">
                <Star size={11} className="text-bronze" />
                <span className="tabular-nums">{rating}</span>
              </span>
            )}
            {isThinking && (
              <span className="text-[10px] font-mono text-bronze animate-pulse">
                • pensando...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Captured Pieces & Material Balance */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Pieces Row */}
        <div className="flex items-center text-sm sm:text-base leading-none text-noir-muted font-serif tracking-tighter">
          {sortedPieces.map((p, idx) => {
            const Icon = PIECE_ICONS[p];
            return Icon ? (
              <Icon
                key={idx}
                size={16}
                className={`inline-block -ml-1 first:ml-0 drop-shadow-sm ${
                  capturedColor === "white" ? "text-noir-ink" : "text-noir-muted"
                }`}
              />
            ) : (
              <span key={idx}>{p}</span>
            );
          })}
        </div>

        {/* Material Advantage Badge */}
        {materialAdvantage > 0 && (
          <span className="text-xs font-mono font-bold tabular-nums px-1.5 py-0.5 rounded bg-bronze/20 text-bronze border border-bronze/30 shadow-sm animate-in fade-in">
            +{materialAdvantage}
          </span>
        )}
      </div>
    </div>
  );
}
