"use client";

import { useMemo } from "react";
import { calculateEvalPercentage, formatEvalScore } from "@/lib/chess/evalbar";

interface EvalBarProps {
  evaluation: { cp: number; mate: number | null } | null;
  orientation: "white" | "black";
}

export default function EvalBar({ evaluation, orientation }: EvalBarProps) {
  const cp = evaluation?.cp ?? 0;
  const mate = evaluation?.mate ?? null;

  const percentage = useMemo(() => {
    return calculateEvalPercentage(cp, mate, orientation);
  }, [cp, mate, orientation]);

  const scoreText = useMemo(() => {
    return formatEvalScore(cp, mate);
  }, [cp, mate]);

  // Is White currently ahead?
  const isWhiteAhead = mate !== null ? mate > 0 : cp > 0;
  const isBlackAhead = mate !== null ? mate < 0 : cp < 0;

  // Determine label position based on who is leading and board orientation
  // In White orientation: White is on bottom, Black is on top.
  // In Black orientation: Black is on bottom, White is on top.
  const isLeaderOnTop = orientation === "white" ? isBlackAhead : isWhiteAhead;

  return (
    <div
      className="relative w-6 sm:w-7 h-full rounded-lg overflow-hidden border border-zinc-800 bg-[#262421] shadow-inner select-none flex flex-col justify-end"
      title={`Avaliação da posição: ${scoreText}`}
      aria-label={`Barra de avaliação: ${scoreText}`}
    >
      {/* Dynamic bar representing the bottom player's color */}
      <div
        className={`w-full transition-all duration-500 ease-out ${
          orientation === "white" ? "bg-zinc-100" : "bg-[#181715]"
        }`}
        style={{ height: `${percentage}%` }}
      />

      {/* Floating score label */}
      <div
        className={`absolute inset-x-0 flex justify-center text-[10px] sm:text-xs font-mono font-bold tracking-tighter ${
          isLeaderOnTop
            ? `top-2 ${orientation === "white" ? "text-zinc-300" : "text-zinc-800"}`
            : `bottom-2 ${orientation === "white" ? "text-zinc-800" : "text-zinc-300"}`
        }`}
      >
        {scoreText}
      </div>
    </div>
  );
}
