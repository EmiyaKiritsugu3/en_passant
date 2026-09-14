"use client";

import { memo, useEffect, useRef } from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

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

export default memo(function MoveHistory({
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
    <div className="flex flex-col h-full bg-noir-surface/70 border border-noir-line rounded-2xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-noir-line bg-noir-surface/90">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-display font-bold uppercase tracking-wider text-noir-ink">
            Lances
          </h2>
          <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-noir-raised text-noir-muted">
            {Math.floor(moves.length / 2)} {moves.length % 2 !== 0 ? "½" : ""}
          </span>
        </div>

        {isReviewing && (
          <button
            onClick={() => onSelectPly(moves.length)}
            className="text-[11px] font-mono font-bold text-bronze flex items-center gap-1 transition-colors animate-pulse"
          >
            <span>● Ao vivo</span>
          </button>
        )}
      </div>

      {/* Review Mode Alert Banner */}
      {isReviewing && (
        <div className="px-3 py-1.5 bg-bronze/10 border-b border-bronze/20 flex items-center justify-between text-[11px] font-mono text-bronze">
          <span>Modo Análise: Lance {Math.ceil(currentViewingPly / 2) || 0}</span>
          <button
            onClick={() => onSelectPly(moves.length)}
            className="px-2 py-0.5 rounded bg-bronze/20 hover:bg-bronze/30 text-bronze transition-colors"
          >
            Voltar ao jogo
          </button>
        </div>
      )}

      {/* Move List Table */}
      <div
        ref={scrollRef}
        id="moves-list"
        role="region"
        aria-label="Lances da partida"
        className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 font-mono text-xs select-none max-h-[190px] sm:max-h-[220px]"
      >
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-noir-muted text-xs py-8">
            Nenhum lance jogado ainda
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.moveNum}
              className="flex items-center py-1 px-2 rounded hover:bg-noir-raised/40 transition-colors"
            >
              {/* Turn Number */}
              <span className="w-8 text-noir-muted text-[11px] tabular-nums">
                {row.moveNum}.
              </span>

              {/* White Move */}
              <button
                type="button"
                onClick={() => row.white && onSelectPly(row.white.ply)}
                className={`flex-1 text-left px-2 py-0.5 rounded transition-all ${
                  row.white?.ply === currentViewingPly
                    ? "bg-bronze/25 text-bronze font-bold shadow-sm"
                    : "text-noir-ink hover:text-noir-ink"
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
                    ? "bg-bronze/25 text-bronze font-bold shadow-sm"
                    : "text-noir-muted hover:text-noir-ink"
                }`}
              >
                {row.black?.san || ""}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Transport Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-noir-line bg-noir-surface/90 text-noir-muted">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectPly(0)}
            disabled={currentViewingPly === 0}
            title="Início da partida"
            aria-label="Início da partida"
            className="p-1.5 rounded-lg hover:bg-noir-raised hover:text-noir-ink disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => onSelectPly(Math.max(0, currentViewingPly - 1))}
            disabled={currentViewingPly === 0}
            title="Lance anterior"
            aria-label="Lance anterior"
            className="p-1.5 rounded-lg hover:bg-noir-raised hover:text-noir-ink disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => onSelectPly(Math.min(moves.length, currentViewingPly + 1))}
            disabled={currentViewingPly === moves.length}
            title="Próximo lance"
            aria-label="Próximo lance"
            className="p-1.5 rounded-lg hover:bg-noir-raised hover:text-noir-ink disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => onSelectPly(moves.length)}
            disabled={currentViewingPly === moves.length}
            title="Último lance (ao vivo)"
            aria-label="Último lance (ao vivo)"
            className="p-1.5 rounded-lg hover:bg-noir-raised hover:text-noir-ink disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs"
          >
            <ChevronsRight size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={onFlipBoard}
          title="Inverter orientação do tabuleiro"
          aria-label="Inverter orientação do tabuleiro"
          className="p-1.5 rounded-lg hover:bg-noir-raised hover:text-bronze transition-colors text-xs flex items-center gap-1 font-mono text-[11px]"
        >
          <ArrowLeftRight size={14} />
          <span className="hidden sm:inline">Inverter</span>
        </button>
      </div>
    </div>
  );
});
