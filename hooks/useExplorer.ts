"use client";

import { useCallback, useState } from "react";
import {
  fetchExplorerMoves,
  fetchExplorerStats,
  type ExplorerMove,
  type ExplorerStats,
} from "@/lib/lichess/explorer";

// Shared Lichess masters explorer state (train drill/explore, study free move).
// Loaders update state and return the fresh data; top-5 slice applied on moves.
export function useExplorer() {
  const [explorerMoves, setExplorerMoves] = useState<ExplorerMove[]>([]);
  const [explorerStats, setExplorerStats] = useState<ExplorerStats | null>(null);

  const loadMoves = useCallback(async (fen: string, limit = 5): Promise<ExplorerMove[]> => {
    const top = (await fetchExplorerMoves(fen)).slice(0, limit);
    setExplorerMoves(top);
    return top;
  }, []);

  const loadStats = useCallback(async (fen: string): Promise<ExplorerStats | null> => {
    const stats = await fetchExplorerStats(fen);
    setExplorerStats(stats);
    return stats;
  }, []);

  const resetExplorer = useCallback(() => {
    setExplorerMoves([]);
    setExplorerStats(null);
  }, []);

  return { explorerMoves, explorerStats, loadMoves, loadStats, resetExplorer };
}
