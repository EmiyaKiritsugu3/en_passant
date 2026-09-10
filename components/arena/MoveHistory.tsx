"use client";

import { useEffect, useRef } from "react";

export interface HistoryMove {
  ply: number;
  san: string;
  from: string;
  to: string;
}

interface MoveHistoryProps {
  moves: HistoryMove[];
  currentViewingPly: number;
  onSelectPly: (ply: number) => void;
  onFlipBoard: () => void;
}

export default function MoveHistory({
  moves,
  currentViewingPly,
  onSelectPly,
  onFlipBoard,
}: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isReviewing = currentViewingPly < moves.length;

  // Group moves by turn (White and Black pairs)
  const rows: { moveNum: number; white?: HistoryMove; black?: HistoryMove }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      moveNum: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  // Auto-scroll to bottom when in live play
  useEffect(() => {
    if (!isReviewing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length, isReviewing]);

  return (
    <div className="flex flex-col h-full bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/90">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
            Lances
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            {Math.floor(moves.length / 2)} {moves.length % 2 !== 0 ? "½" : ""}
          </span>
        </div>

        {isReviewing && (
          <button
            onClick={() => onSelectPly(moves.length)}
            className="text-[11px] font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors animate-pulse"
          >
            <span>● Ao vivo</span>
          </button>
        )}
      </div>

      {/* Review Mode Alert Banner */}
      {isReviewing && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-[11px] font-mono text-amber-300">
          <span>Modo Análise: Lance {Math.ceil(currentViewingPly / 2) || 0}</span>
          <button
            onClick={() => onSelectPly(moves.length)}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors"
          >
            Voltar ao jogo ⏭
          </button>
        </div>
      )}

      {/* Move List Table */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 font-mono text-xs select-none max-h-[190px] sm:max-h-[220px]"
      >
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xs py-8">
            Nenhum lance jogado ainda
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.moveNum}
              className="flex items-center py-1 px-2 rounded hover:bg-zinc-800/40 transition-colors"
            >
              {/* Turn Number */}
              <span className="w-8 text-zinc-500 text-[11px]">
                {row.moveNum}.
              </span>

              {/* White Move */}
              <button
                type="button"
                onClick={() => row.white && onSelectPly(row.white.ply)}
                className={`flex-1 text-left px-2 py-0.5 rounded transition-all ${
                  row.white?.ply === currentViewingPly
                    ? "bg-amber-500/25 text-amber-300 font-bold shadow-sm"
                    : "text-zinc-200 hover:text-white"
                }`}
              >
                {row.white?.san || ""}
              </button>

              {/* Black Move */}
              <button
                type="button"
                onClick={() => row.black && onSelectPly(row.black.ply)}
                className={`flex-1 text-left px-2 py-0.5 rounded transition-all ${
                  row.black?.ply === currentViewingPly
                    ? "bg-amber-500/25 text-amber-300 font-bold shadow-sm"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                {row.black?.san || ""}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Transport Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-800/80 bg-zinc-900/90 text-zinc-400">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectPly(0)}
            disabled={currentViewingPly === 0}
            title="Início da partida"
            className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={() => onSelectPly(Math.max(0, currentViewingPly - 1))}
            disabled={currentViewingPly === 0}
            title="Lance anterior"
            className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => onSelectPly(Math.min(moves.length, currentViewingPly + 1))}
            disabled={currentViewingPly === moves.length}
            title="Próximo lance"
            className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => onSelectPly(moves.length)}
            disabled={currentViewingPly === moves.length}
            title="Último lance (ao vivo)"
            className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs"
          >
            ⏭
          </button>
        </div>

        <button
          type="button"
          onClick={onFlipBoard}
          title="Inverter orientação do tabuleiro"
          className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-amber-400 transition-colors text-xs flex items-center gap-1 font-mono text-[11px]"
        >
          <span>🔄</span>
          <span className="hidden sm:inline">Inverter</span>
        </button>
      </div>
    </div>
  );
}
