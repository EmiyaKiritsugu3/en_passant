"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import curatedGamesData from "@/data/games.json";
import repertoireData from "@/data/repertoire.json";
import {
  fetchExplorerMoves,
  fetchExplorerStats,
  type ExplorerMove,
  type ExplorerStats,
} from "@/lib/lichess/explorer";
import { createMockEngine, createStockfishEngine, type Engine } from "@/lib/engine/engine";
import type { ExploreResponse } from "@/lib/coach/schemas";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";

interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  pgn: string;
  tags: string[];
  lesson: string;
  source: "classic" | "repertoire";
}

function StudyContent() {
  const searchParams = useSearchParams();
  const filterTag = searchParams.get("tag");

  // Format all chapters
  const allChapters: Chapter[] = useMemo(() => {
    const list: Chapter[] = [];

    // Classics from games.json
    for (const g of curatedGamesData) {
      list.push({
        id: g.id,
        title: `${g.white} vs ${g.black}${g.year ? ` (${g.year})` : ""}`,
        subtitle: g.id,
        pgn: g.pgn,
        tags: g.tags,
        lesson: g.lesson,
        source: "classic",
      });
    }

    // Repertoire lines
    for (const r of repertoireData.white) {
      list.push({
        id: `rep-w-${r.name.toLowerCase().replace(/\s+/g, "-")}`,
        title: `[Brancas] ${r.name}`,
        subtitle: "Repertório Teórico",
        pgn: r.line.map((san, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}${san}`).join(" "),
        tags: ["abertura"],
        lesson: `Linha teórica de ${r.name}. Domine o controle do centro e desenvolvimento rápido.`,
        source: "repertoire",
      });
    }

    for (const r of repertoireData.black) {
      list.push({
        id: `rep-b-${r.name.toLowerCase().replace(/\s+/g, "-")}`,
        title: `[Pretas] ${r.name}`,
        subtitle: "Repertório Teórico",
        pgn: r.line.map((san, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}${san}`).join(" "),
        tags: ["abertura"],
        lesson: `Defesa de pretas com ${r.name}. Estrutura sólida e contra-ataque.`,
        source: "repertoire",
      });
    }

    return list;
  }, []);

  // Initial chapter based on tag param or first chapter
  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => {
    if (filterTag) {
      const match = allChapters.find((c) => c.tags.includes(filterTag));
      if (match) return match.id;
    }
    return allChapters[0]?.id || "";
  });

  const activeChapter = allChapters.find((c) => c.id === selectedChapterId) || allChapters[0];

  const [currentPly, setCurrentPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [isExploreMode, setIsExploreMode] = useState(false);

  // Cached comments per move key `chapterId:ply`
  const [commentsCache, setCommentsCache] = useState<Record<string, ExploreResponse>>({});
  const [isCommentLoading, setIsCommentLoading] = useState(false);

  // Explorer state
  const [explorerMoves, setExplorerMoves] = useState<ExplorerMove[]>([]);
  const [explorerStats, setExplorerStats] = useState<ExplorerStats | null>(null);
  const [freeExploreFen, setFreeExploreFen] = useState<string | null>(null);
  const [freeExploreShapes, setFreeExploreShapes] = useState<DrawShape[]>([]);

  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    try {
      engineRef.current = createStockfishEngine();
    } catch {
      engineRef.current = createMockEngine();
    }
    return () => {
      engineRef.current?.quit();
    };
  }, []);

  // Parse moves of active chapter
  const parsedMoves = useMemo(() => {
    if (!activeChapter) return [];
    try {
      const c = new Chess();
      c.loadPgn(activeChapter.pgn);
      return c.history({ verbose: true });
    } catch {
      return [];
    }
  }, [activeChapter]);

  // Board position based on currentPly
  const currentBoardFen = useMemo(() => {
    if (freeExploreFen && isExploreMode) return freeExploreFen;
    const c = new Chess();
    for (let i = 0; i < currentPly && i < parsedMoves.length; i++) {
      c.move(parsedMoves[i].san);
    }
    return c.fen();
  }, [parsedMoves, currentPly, freeExploreFen, isExploreMode]);

  // When chapter changes, reset
  const handleSelectChapter = (ch: Chapter) => {
    setSelectedChapterId(ch.id);
    setCurrentPly(0);
    setIsExploreMode(false);
    setFreeExploreFen(null);
    setFreeExploreShapes([]);
    setExplorerMoves([]);
    setExplorerStats(null);
  };

  // Fetch coach comment for current ply
  useEffect(() => {
    if (isExploreMode || !activeChapter || parsedMoves.length === 0 || currentPly === 0) return;
    const cacheKey = `${activeChapter.id}:${currentPly}`;
    if (commentsCache[cacheKey]) return;

    let cancelled = false;

    async function loadComment() {
      setIsCommentLoading(true);
      const replay = new Chess();
      for (let i = 0; i < currentPly - 1; i++) {
        replay.move(parsedMoves[i].san);
      }
      const fenBefore = replay.fen();
      const sanPlayed = parsedMoves[currentPly - 1].san;
      replay.move(sanPlayed);
      const fenAfter = replay.fen();

      try {
        const stats = await fetchExplorerStats(fenAfter);
        const res = await fetch("/api/coach/explore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fenBefore,
            sanPlayed,
            cpLoss: 0,
            explorerStats: stats,
            openingName: activeChapter.title,
          }),
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as ExploreResponse;
          setCommentsCache((prev) => ({ ...prev, [cacheKey]: data }));
        }
      } catch {
        if (!cancelled) {
          setCommentsCache((prev) => ({
            ...prev,
            [cacheKey]: {
              verdict: "Lance teórico clássico",
              consequences: activeChapter.lesson,
              namedVariant: activeChapter.title,
            },
          }));
        }
      } finally {
        if (!cancelled) setIsCommentLoading(false);
      }
    }

    loadComment();
    return () => {
      cancelled = true;
    };
  }, [activeChapter, currentPly, isExploreMode, parsedMoves, commentsCache]);

  // Handle free exploration move
  const handleFreeMove = async (from: string, to: string) => {
    if (!isExploreMode) return;
    try {
      const c = new Chess(currentBoardFen);
      const move = c.move({ from, to, promotion: "q" });
      if (!move) return;

      const fenAfter = c.fen();
      setFreeExploreFen(fenAfter);

      const [moves, stats] = await Promise.all([
        fetchExplorerMoves(fenAfter),
        fetchExplorerStats(fenAfter),
      ]);
      setExplorerMoves(moves.slice(0, 5));
      setExplorerStats(stats);
      setFreeExploreShapes([{ orig: from as Key, dest: to as Key, brush: "green" }]);
    } catch {
      // illegal move ignored
    }
  };

  const currentComment = activeChapter ? commentsCache[`${activeChapter.id}:${currentPly}`] : undefined;

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 p-4 md:p-8 flex flex-col items-center">
      {/* Top Header */}
      <header className="w-full max-w-7xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-zinc-800 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
            Modo Estudo & Partidas Modelo
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Estudo Interativo</h1>
        </div>

        <div className="flex gap-3">
          <Link
            href="/library"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            ← Biblioteca
          </Link>
          <Link
            href="/train"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Treinar
          </Link>
          <Link
            href="/play"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            Jogar
          </Link>
        </div>
      </header>

      {/* 3-Column Layout */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chapters / Repertoire & Classics (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Capítulos de Estudo
            </span>

            <div className="max-h-[580px] overflow-y-auto flex flex-col gap-2 pr-1">
              {allChapters.map((ch) => {
                const isSelected = ch.id === activeChapter?.id;
                return (
                  <div
                    key={ch.id}
                    onClick={() => handleSelectChapter(ch)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-1 ${
                      isSelected
                        ? "bg-emerald-950/40 border-emerald-500 text-white shadow"
                        : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-[11px] truncate">{ch.title}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                          ch.source === "classic"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                        }`}
                      >
                        {ch.source === "classic" ? "Clássico" : "Abertura"}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{ch.subtitle}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ch.tags.map((t) => (
                        <span key={t} className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-1 rounded">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Column: Board & Navigation (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4">
          {activeChapter && (
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center gap-4 w-full shadow-xl">
              <div className="w-full flex justify-between items-center text-xs font-mono">
                <div>
                  <h2 className="font-bold text-white text-sm">{activeChapter.title}</h2>
                  <span className="text-zinc-500 text-[11px]">{activeChapter.subtitle}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => {
                      setIsExploreMode((prev) => !prev);
                      setFreeExploreFen(null);
                      setFreeExploreShapes([]);
                    }}
                    className={`px-3 py-1 text-xs font-mono rounded-lg border transition-all ${
                      isExploreMode
                        ? "bg-cyan-700 border-cyan-500 text-white font-bold"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {isExploreMode ? "● Modo Livre Ativo" : "Explorar Lances"}
                  </button>
                  <button
                    onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                    className="p-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 text-xs"
                    title="Girar tabuleiro"
                  >
                    ↻
                  </button>
                </div>
              </div>

              {/* Board */}
              <Board
                fen={currentBoardFen}
                orientation={orientation}
                onMove={handleFreeMove}
                shape={freeExploreShapes}
              />

              {/* Navigation buttons */}
              <div className="flex gap-2 w-full max-w-[480px]">
                <button
                  onClick={() => {
                    setCurrentPly(0);
                    setFreeExploreFen(null);
                  }}
                  disabled={currentPly === 0}
                  className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                >
                  |&lt;
                </button>
                <button
                  onClick={() => {
                    setCurrentPly((p) => Math.max(0, p - 1));
                    setFreeExploreFen(null);
                  }}
                  disabled={currentPly === 0}
                  className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                >
                  &lt;
                </button>
                <button
                  onClick={() => {
                    setCurrentPly((p) => Math.min(parsedMoves.length, p + 1));
                    setFreeExploreFen(null);
                  }}
                  disabled={currentPly >= parsedMoves.length}
                  className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                >
                  &gt;
                </button>
                <button
                  onClick={() => {
                    setCurrentPly(parsedMoves.length);
                    setFreeExploreFen(null);
                  }}
                  disabled={currentPly >= parsedMoves.length}
                  className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                >
                  &gt;|
                </button>
              </div>

              {/* Lesson Callout */}
              <div className="w-full p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 text-xs">
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Lição Principal</span>
                <p className="text-zinc-300 mt-1 leading-relaxed">{activeChapter.lesson}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Move steps & Annotated Comments (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              {isExploreMode ? "Exploração Livre" : "Comentários do Lance"}
            </span>

            {/* In Study Replay mode: Show coach annotation */}
            {!isExploreMode && (
              <>
                {currentPly > 0 && parsedMoves[currentPly - 1] && (
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-mono flex justify-between items-center">
                    <span className="text-zinc-400">Lance {currentPly}:</span>
                    <strong className="text-amber-400 text-sm">{parsedMoves[currentPly - 1].san}</strong>
                  </div>
                )}

                {currentComment ? (
                  <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex flex-col gap-2 text-xs">
                    <span className="text-emerald-400 font-bold uppercase text-[10px] tracking-wider">
                      Comentário do Treinador:
                    </span>
                    <p className="font-semibold text-white">{currentComment.verdict}</p>
                    <p className="text-zinc-300 leading-relaxed">{currentComment.consequences}</p>
                  </div>
                ) : isCommentLoading ? (
                  <div className="text-xs font-mono text-emerald-400 animate-pulse py-3 text-center">
                    Gerando anotação do lance...
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 py-3 text-center">
                    Avance os lances para ver as anotações do treinador.
                  </div>
                )}

                {/* Moves List Grid */}
                <div className="max-h-60 overflow-y-auto p-2 bg-zinc-950 rounded-xl border border-zinc-800 grid grid-cols-2 gap-1 font-mono text-xs mt-2">
                  {parsedMoves.map((m, idx) => {
                    const plyNum = idx + 1;
                    const isSelected = plyNum === currentPly;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentPly(plyNum);
                          setFreeExploreFen(null);
                        }}
                        className={`px-2 py-1 rounded text-left flex justify-between items-center transition-all ${
                          isSelected
                            ? "bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 font-bold"
                            : "hover:bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        <span>
                          {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : "..."}
                          {m.san}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* In Free Explore mode: Show Lichess masters stats */}
            {isExploreMode && (
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-xl text-xs font-mono text-cyan-300">
                  Modo livre ativo: jogue qualquer lance no tabuleiro para consultar as respostas teóricas da base de mestres.
                </div>

                {explorerStats && (
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-mono space-y-1">
                    {explorerStats.opening && (
                      <div className="text-zinc-200 font-bold">
                        {explorerStats.opening.eco} - {explorerStats.opening.name}
                      </div>
                    )}
                    <div className="flex gap-2 text-[11px]">
                      <span className="text-emerald-400">1-0: {explorerStats.white}</span>
                      <span className="text-zinc-400">½-½: {explorerStats.draws}</span>
                      <span className="text-rose-400">0-1: {explorerStats.black}</span>
                    </div>
                  </div>
                )}

                {explorerMoves.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 text-[10px]">
                          <th className="pb-1">Lance</th>
                          <th className="pb-1">Partidas</th>
                          <th className="pb-1">1-0</th>
                          <th className="pb-1">½-½</th>
                          <th className="pb-1">0-1</th>
                        </tr>
                      </thead>
                      <tbody>
                        {explorerMoves.map((m) => {
                          const total = m.white + m.draws + m.black || 1;
                          const wPct = Math.round((m.white / total) * 100);
                          const dPct = Math.round((m.draws / total) * 100);
                          const bPct = Math.round((m.black / total) * 100);
                          return (
                            <tr key={m.san} className="border-b border-zinc-800/40 text-zinc-300">
                              <td className="py-1 text-amber-400 font-bold">{m.san}</td>
                              <td className="py-1 text-zinc-400">{total}</td>
                              <td className="py-1 text-emerald-400">{wPct}%</td>
                              <td className="py-1 text-zinc-400">{dPct}%</td>
                              <td className="py-1 text-rose-400">{bPct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#161512] flex items-center justify-center text-zinc-400 font-mono text-xs">Carregando estudo...</div>}>
      <StudyContent />
    </Suspense>
  );
}
