"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import curatedGamesData from "@/data/games.json";
import repertoireData from "@/data/repertoire.json";
import { fetchExplorerStats } from "@/lib/lichess/explorer";
import { useExplorer } from "@/hooks/useExplorer";
import { postCoachJson } from "@/lib/coach/client";
import type { ExploreResponse } from "@/lib/coach/schemas";
import type { DrawShape } from "chessgroundx/draw";
import type { Key } from "chessgroundx/types";

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
  const { explorerMoves, explorerStats, loadMoves, loadStats, resetExplorer } = useExplorer();
  const [freeExploreFen, setFreeExploreFen] = useState<string | null>(null);
  const [freeExploreShapes, setFreeExploreShapes] = useState<DrawShape[]>([]);

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
    resetExplorer();
  };

  // Fetch coach comment for current ply
  const currentCommentKey = activeChapter ? `${activeChapter.id}:${currentPly}` : "";
  const hasCachedComment = Boolean(commentsCache[currentCommentKey]);

  useEffect(() => {
    if (isExploreMode || !activeChapter || parsedMoves.length === 0 || currentPly === 0 || hasCachedComment) return;
    const cacheKey = `${activeChapter.id}:${currentPly}`;

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
        const data = await postCoachJson<ExploreResponse>("/api/coach/explore", {
          fenBefore,
          sanPlayed,
          cpLoss: 0,
          explorerStats: stats,
          openingName: activeChapter.title,
        });
        if (!cancelled) {
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
  }, [activeChapter, currentPly, isExploreMode, parsedMoves, hasCachedComment]);

  // Handle free exploration move
  const handleFreeMove = async (from: string, to: string) => {
    if (!isExploreMode) return;
    try {
      const c = new Chess(currentBoardFen);
      const move = c.move({ from, to, promotion: "q" });
      if (!move) return;

      const fenAfter = c.fen();
      setFreeExploreFen(fenAfter);

      await Promise.all([loadMoves(fenAfter), loadStats(fenAfter)]);
      setFreeExploreShapes([{ orig: from as Key, dest: to as Key, brush: "green" }]);
    } catch {
      // illegal move ignored
    }
  };

  const currentComment = activeChapter ? commentsCache[`${activeChapter.id}:${currentPly}`] : undefined;

  return (
    <main className="min-h-screen bg-noir-bg text-noir-ink p-4 md:p-8 flex flex-col items-center">
      {/* Top Header */}
      <header className="w-full max-w-7xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-noir-line pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
            Modo Estudo & Partidas Modelo
          </span>
          <h1 className="text-2xl font-bold font-display text-noir-ink tracking-tight">Estudo Interativo</h1>
        </div>

        <div className="flex gap-3">
          <Link
            href="/library"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-noir-raised hover:bg-noir-line text-noir-muted transition-colors"
          >
            ← Biblioteca
          </Link>
          <Link
            href="/train"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-noir-raised hover:bg-noir-line text-noir-muted transition-colors"
          >
            Treinar
          </Link>
          <Link
            href="/play"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-bronze-deep hover:bg-bronze text-white font-semibold transition-colors"
          >
            Jogar
          </Link>
        </div>
      </header>

      {/* 3-Column Layout */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chapters / Repertoire & Classics (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-noir-surface/80 border border-noir-line rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <span className="text-xs font-mono uppercase tracking-wider text-noir-muted">
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
                        : "bg-noir-bg/60 border-noir-line text-noir-muted hover:border-noir-line hover:text-noir-ink"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-[11px] truncate">{ch.title}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                          ch.source === "classic"
                            ? "bg-bronze/10 text-bronze border border-bronze/30"
                            : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                        }`}
                      >
                        {ch.source === "classic" ? "Clássico" : "Abertura"}
                      </span>
                    </div>
                    <span className="text-[10px] text-noir-muted">{ch.subtitle}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ch.tags.map((t) => (
                        <span key={t} className="text-[9px] font-mono text-noir-muted bg-noir-raised px-1 rounded">
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
            <div className="bg-noir-surface/80 border border-noir-line rounded-2xl p-5 flex flex-col items-center gap-4 w-full shadow-xl">
              <div className="w-full flex justify-between items-center text-xs font-mono">
                <div>
                  <h2 className="font-bold text-white text-sm">{activeChapter.title}</h2>
                  <span className="text-noir-muted text-[11px]">{activeChapter.subtitle}</span>
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
                        : "bg-noir-bg border-noir-line text-noir-muted hover:text-noir-ink"
                    }`}
                  >
                    {isExploreMode ? "● Modo Livre Ativo" : "Explorar Lances"}
                  </button>
                  <button
                    onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                    className="p-1.5 bg-noir-bg hover:bg-noir-raised border border-noir-line rounded-lg text-noir-muted text-xs"
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
                  className="flex-1 py-2 bg-noir-bg hover:bg-noir-raised disabled:opacity-40 border border-noir-line rounded-xl text-xs font-mono text-noir-muted"
                >
                  |&lt;
                </button>
                <button
                  onClick={() => {
                    setCurrentPly((p) => Math.max(0, p - 1));
                    setFreeExploreFen(null);
                  }}
                  disabled={currentPly === 0}
                  className="flex-1 py-2 bg-noir-bg hover:bg-noir-raised disabled:opacity-40 border border-noir-line rounded-xl text-xs font-mono text-noir-muted"
                >
                  &lt;
                </button>
                <button
                  onClick={() => {
                    setCurrentPly((p) => Math.min(parsedMoves.length, p + 1));
                    setFreeExploreFen(null);
                  }}
                  disabled={currentPly >= parsedMoves.length}
                  className="flex-1 py-2 bg-noir-bg hover:bg-noir-raised disabled:opacity-40 border border-noir-line rounded-xl text-xs font-mono text-noir-muted"
                >
                  &gt;
                </button>
                <button
                  onClick={() => {
                    setCurrentPly(parsedMoves.length);
                    setFreeExploreFen(null);
                  }}
                  disabled={currentPly >= parsedMoves.length}
                  className="flex-1 py-2 bg-noir-bg hover:bg-noir-raised disabled:opacity-40 border border-noir-line rounded-xl text-xs font-mono text-noir-muted"
                >
                  &gt;|
                </button>
              </div>

              {/* Lesson Callout */}
              <div className="w-full p-3 bg-noir-bg rounded-xl border border-noir-line text-xs">
                <span className="text-[10px] font-mono uppercase text-bronze font-bold">Lição Principal</span>
                <p className="text-noir-muted mt-1 leading-relaxed">{activeChapter.lesson}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Move steps & Annotated Comments (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-noir-surface/80 border border-noir-line rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <span className="text-xs font-mono uppercase tracking-wider text-noir-muted">
              {isExploreMode ? "Exploração Livre" : "Comentários do Lance"}
            </span>

            {/* In Study Replay mode: Show coach annotation */}
            {!isExploreMode && (
              <>
                {currentPly > 0 && parsedMoves[currentPly - 1] && (
                  <div className="p-3 bg-noir-bg rounded-xl border border-noir-line text-xs font-mono flex justify-between items-center">
                    <span className="text-noir-muted">Lance {currentPly}:</span>
                    <strong className="text-bronze text-sm">{parsedMoves[currentPly - 1].san}</strong>
                  </div>
                )}

                {currentComment ? (
                  <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex flex-col gap-2 text-xs">
                    <span className="text-emerald-400 font-bold uppercase text-[10px] tracking-wider">
                      Comentário do Treinador:
                    </span>
                    <p className="font-semibold text-white">{currentComment.verdict}</p>
                    <p className="text-noir-muted leading-relaxed">{currentComment.consequences}</p>
                  </div>
                ) : isCommentLoading ? (
                  <div className="text-xs font-mono text-emerald-400 animate-pulse py-3 text-center">
                    Gerando anotação do lance...
                  </div>
                ) : (
                  <div className="text-xs text-noir-muted py-3 text-center">
                    Avance os lances para ver as anotações do treinador.
                  </div>
                )}

                {/* Moves List Grid */}
                <div className="max-h-60 overflow-y-auto p-2 bg-noir-bg rounded-xl border border-noir-line grid grid-cols-2 gap-1 font-mono text-xs mt-2">
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
                            : "hover:bg-noir-surface text-noir-muted"
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
                  <div className="p-3 bg-noir-bg rounded-xl border border-noir-line text-xs font-mono space-y-1">
                    {explorerStats.opening && (
                      <div className="text-noir-ink font-bold">
                        {explorerStats.opening.eco} - {explorerStats.opening.name}
                      </div>
                    )}
                    <div className="flex gap-2 text-[11px]">
                      <span className="text-emerald-400">1-0: {explorerStats.white}</span>
                      <span className="text-noir-muted">½-½: {explorerStats.draws}</span>
                      <span className="text-rose-400">0-1: {explorerStats.black}</span>
                    </div>
                  </div>
                )}

                {explorerMoves.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-noir-line text-noir-muted text-[10px]">
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
                            <tr key={m.san} className="border-b border-noir-line text-noir-muted">
                              <td className="py-1 text-bronze font-bold">{m.san}</td>
                              <td className="py-1 text-noir-muted">{total}</td>
                              <td className="py-1 text-emerald-400">{wPct}%</td>
                              <td className="py-1 text-noir-muted">{dPct}%</td>
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
    <Suspense fallback={<div className="min-h-screen bg-noir-bg flex items-center justify-center text-noir-muted font-mono text-xs">Carregando estudo...</div>}>
      <StudyContent />
    </Suspense>
  );
}
