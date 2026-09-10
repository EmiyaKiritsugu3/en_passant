"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import {
  dueCards,
  reviewCard,
  saveCards,
  addCard,
  subscribeCards,
  getCardsSnapshot,
  type Card,
} from "@/lib/sm2/scheduler";
import { checkDrillMove } from "@/lib/repertoire/drill";
import {
  fetchExplorerMoves,
  fetchExplorerStats,
  type ExplorerMove,
  type ExplorerStats,
} from "@/lib/lichess/explorer";
import { createMockEngine, createStockfishEngine, type Engine } from "@/lib/engine/engine";
import type { ExploreResponse } from "@/lib/coach/schemas";
import repertoireData from "@/data/repertoire.json";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";

type MainTab = "sm2" | "openings";
type OpeningMode = "drill" | "explore";

interface RepertoireLine {
  name: string;
  line: string[];
}

const EMPTY_CARDS: Card[] = [];

export default function TrainPage() {
  const [mainTab, setMainTab] = useState<MainTab>("sm2");

  // ==================== SM-2 STATE ====================
  const allCards = useSyncExternalStore(subscribeCards, getCardsSnapshot, () => EMPTY_CARDS);
  const [currentSm2Index, setCurrentSm2Index] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [sm2Attempts, setSm2Attempts] = useState(0);
  const [sm2StatusText, setSm2StatusText] = useState("");
  const [isSm2Resolved, setIsSm2Resolved] = useState(false);
  const [sm2Shape, setSm2Shape] = useState<DrawShape[]>([]);

  const due = dueCards(allCards);
  const currentCard: Card | undefined = due[currentSm2Index];
  const sm2Orientation: "white" | "black" =
    currentCard && currentCard.fen.split(" ")[1] === "b" ? "black" : "white";

  const [prevCardId, setPrevCardId] = useState<string | undefined>(currentCard?.id);
  if (currentCard?.id !== prevCardId) {
    setPrevCardId(currentCard?.id);
    setHintUsed(false);
    setSm2Attempts(0);
    setSm2StatusText("");
    setIsSm2Resolved(false);
    setSm2Shape([]);
  }

  // ==================== OPENINGS STATE ====================
  const [openingMode, setOpeningMode] = useState<OpeningMode>("drill");
  const [selectedColor, setSelectedColor] = useState<"white" | "black">("white");
  const [activeLine, setActiveLine] = useState<RepertoireLine>(repertoireData.white[0]);

  const openingGame = useMemo(() => new Chess(), []);
  const [openingFen, setOpeningFen] = useState(openingGame.fen());
  const [drillPly, setDrillPly] = useState(0);
  const [drillStatus, setDrillStatus] = useState<string>("");
  const [drillCompleted, setDrillCompleted] = useState(false);
  const [openingShape, setOpeningShape] = useState<DrawShape[]>([]);

  // Explorer stats state
  const [explorerMoves, setExplorerMoves] = useState<ExplorerMove[]>([]);
  const [explorerStats, setExplorerStats] = useState<ExplorerStats | null>(null);
  const [coachExplore, setCoachExplore] = useState<ExploreResponse | null>(null);
  const [isExploreLoading, setIsExploreLoading] = useState(false);
  const [lastDeviationEval, setLastDeviationEval] = useState<{ cpLoss: number; best: string } | null>(null);

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

  // ==================== SM-2 HANDLERS ====================
  const handleSm2Move = (from: string, to: string) => {
    if (!currentCard || isSm2Resolved) return;

    const uciMove = `${from}${to}`.toLowerCase();
    const expected = currentCard.bestMove.toLowerCase();
    const isCorrect = expected.startsWith(uciMove);

    if (isCorrect) {
      const quality = sm2Attempts === 0 ? (hintUsed ? 4 : 5) : 2;
      const updatedCard = reviewCard(currentCard, quality);
      const nextAll = allCards.map((c) => (c.id === currentCard.id ? updatedCard : c));
      saveCards(nextAll);

      setSm2StatusText("Correto! Excelente resolução tática.");
      setIsSm2Resolved(true);
      setSm2Shape([{ orig: from as Key, dest: to as Key, brush: "green" }]);
      setDoneCount((prev) => prev + 1);
    } else {
      setSm2Attempts((prev) => prev + 1);
      setSm2StatusText("Lance impreciso ou incorreto. Tente calcular outra jogada.");
      setSm2Shape([{ orig: from as Key, dest: to as Key, brush: "red" }]);
    }
  };

  const handleSm2Hint = () => {
    if (!currentCard || isSm2Resolved) return;
    setHintUsed(true);
    const originSquare = currentCard.bestMove.slice(0, 2) as Key;
    setSm2Shape([{ orig: originSquare, dest: originSquare, brush: "yellow" }]);
    setSm2StatusText(`Dica: A peça chave a mover está na casa ${originSquare.toUpperCase()}.`);
  };

  const handleSm2GiveUp = () => {
    if (!currentCard || isSm2Resolved) return;
    const updatedCard = reviewCard(currentCard, 0);
    const nextAll = allCards.map((c) => (c.id === currentCard.id ? updatedCard : c));
    saveCards(nextAll);

    setIsSm2Resolved(true);
    const orig = currentCard.bestMove.slice(0, 2) as Key;
    const dest = currentCard.bestMove.slice(2, 4) as Key;
    setSm2Shape([{ orig, dest, brush: "blue" }]);
    setSm2StatusText(`Solução: o melhor lance era ${currentCard.bestMove.toUpperCase()}.`);
    setDoneCount((prev) => prev + 1);
  };

  const handleSm2Next = () => {
    setHintUsed(false);
    setSm2Attempts(0);
    setSm2StatusText("");
    setIsSm2Resolved(false);
    setSm2Shape([]);
    if (currentSm2Index >= due.length - 1) {
      setCurrentSm2Index(0);
    }
  };

  const handleSeedExample = () => {
    addCard({
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
      bestMove: "h5f7",
      context: "Abertura - Tática de mate em 1 lance",
    });
  };

  // ==================== OPENINGS HANDLERS ====================
  const resetDrillLine = (line: RepertoireLine, color: "white" | "black") => {
    setActiveLine(line);
    openingGame.reset();
    setOpeningFen(openingGame.fen());
    setDrillPly(0);
    setDrillCompleted(false);
    setDrillStatus("");
    setOpeningShape([]);
    setExplorerMoves([]);
    setExplorerStats(null);
    setCoachExplore(null);
    setLastDeviationEval(null);

    // If student is playing black, auto-play White's first move
    if (color === "black" && line.line.length > 0) {
      setTimeout(() => {
        try {
          openingGame.move(line.line[0]);
          setOpeningFen(openingGame.fen());
          setDrillPly(1);
        } catch {
          // ignore
        }
      }, 300);
    }
  };

  const handleSelectLine = (line: RepertoireLine) => {
    resetDrillLine(line, selectedColor);
  };

  const handleSelectColor = (color: "white" | "black") => {
    setSelectedColor(color);
    const defaultLine = color === "white" ? repertoireData.white[0] : repertoireData.black[0];
    resetDrillLine(defaultLine, color);
  };

  const handleOpeningMove = async (from: string, to: string) => {
    const legalMoves = openingGame.moves({ verbose: true });
    const move = legalMoves.find((m) => m.from === from && m.to === to);
    if (!move) return;

    if (openingMode === "drill") {
      // DRILL MODE: Verify expected move
      const check = checkDrillMove(activeLine.line, drillPly, move.san);
      if (check.ok) {
        openingGame.move(move.san);
        setOpeningFen(openingGame.fen());
        setOpeningShape([]);
        setLastDeviationEval(null);

        const nextPly = drillPly + 1;
        setDrillPly(nextPly);

        if (nextPly >= activeLine.line.length) {
          setDrillCompleted(true);
          setDrillStatus("🎉 Linha concluída com sucesso! Repertório memorizado.");
          return;
        }

        // Auto-play opponent's move if next ply belongs to opponent
        const opponentColor = selectedColor === "white" ? "b" : "w";
        if (openingGame.turn() === opponentColor && nextPly < activeLine.line.length) {
          setDrillStatus("Adversário respondendo com a linha teórica...");
          setTimeout(() => {
            const oppMoveSan = activeLine.line[nextPly];
            try {
              openingGame.move(oppMoveSan);
              setOpeningFen(openingGame.fen());
              const afterOppPly = nextPly + 1;
              setDrillPly(afterOppPly);
              if (afterOppPly >= activeLine.line.length) {
                setDrillCompleted(true);
                setDrillStatus("🎉 Linha concluída com sucesso! Repertório memorizado.");
              } else {
                setDrillStatus("Sua vez de jogar.");
              }
            } catch {
              // fallback
            }
          }, 400);
        }
      } else {
        // Deviation in drill!
        const fenBefore = openingGame.fen();
        openingGame.move(move.san);
        const fenAfter = openingGame.fen();
        setOpeningFen(fenAfter);

        setDrillStatus(`⚠️ Desvio teórico! Lance jogado: ${move.san}. Esperado: ${check.expected}`);
        setOpeningShape([
          { orig: from as Key, dest: to as Key, brush: "red" },
        ]);

        // Evaluate deviation with engine
        if (engineRef.current) {
          try {
            const evalBefore = await engineRef.current.analyze(fenBefore, 10, { limitStrength: false });
            const evalAfter = await engineRef.current.analyze(fenAfter, 10, { limitStrength: false });
            // In UCI, score cp is from the perspective of the side to move:
            // moverCpBefore = evalBefore.cp; moverCpAfter = -evalAfter.cp;
            // cpLoss = max(0, evalBefore.cp - (-evalAfter.cp)) = max(0, evalBefore.cp + evalAfter.cp)
            const cpLoss = Math.max(0, evalBefore.cp + evalAfter.cp);
            setLastDeviationEval({ cpLoss, best: evalBefore.best });
          } catch {
            // ignore
          }
        }

        // Load explorer continuations for the position
        const moves = await fetchExplorerMoves(fenAfter);
        setExplorerMoves(moves.slice(0, 5));
      }
    } else {
      // EXPLORE MODE: Free exploration of any legal move
      const fenBefore = openingGame.fen();
      openingGame.move(move.san);
      const fenAfter = openingGame.fen();
      setOpeningFen(fenAfter);
      setIsExploreLoading(true);

      let cpLoss = 0;
      if (engineRef.current) {
        try {
          const evalBefore = await engineRef.current.analyze(fenBefore, 10, { limitStrength: false });
          const evalAfter = await engineRef.current.analyze(fenAfter, 10, { limitStrength: false });
          cpLoss = Math.max(0, evalBefore.cp + evalAfter.cp);
          setLastDeviationEval({ cpLoss, best: evalBefore.best });
        } catch {
          // ignore
        }
      }

      try {
        const [moves, stats] = await Promise.all([
          fetchExplorerMoves(fenAfter),
          fetchExplorerStats(fenAfter),
        ]);
        setExplorerMoves(moves.slice(0, 5));
        setExplorerStats(stats);

        // Fetch coach evaluation
        try {
          const res = await fetch("/api/coach/explore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fenBefore,
              sanPlayed: move.san,
              cpLoss,
              explorerStats: stats,
              openingName: stats?.opening?.name || activeLine.name,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as ExploreResponse;
            setCoachExplore(data);
          }
        } catch {
          // fallback coach response
          setCoachExplore({
            verdict: cpLoss > 100 ? "Imprecisão tática" : "Lance jogável e sólido",
            consequences: `Perda calculada de ${cpLoss} centipawns. Posição aberta com opções para ambos os lados.`,
            namedVariant: stats?.opening?.name || activeLine.name,
          });
        }
      } finally {
        setIsExploreLoading(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 p-4 md:p-8 flex flex-col items-center">
      {/* Top Header */}
      <header className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-zinc-800/80 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-amber-500 font-semibold">
            Centro de Treinamento
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Treinador & Aberturas</h1>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setMainTab("sm2")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              mainTab === "sm2"
                ? "bg-amber-600 text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Puzzles de Erros (SM-2)
          </button>
          <button
            onClick={() => setMainTab("openings")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              mainTab === "openings"
                ? "bg-amber-600 text-white shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Repertório & Explorer
          </button>
        </div>

        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Painel
          </Link>
          <Link
            href="/play"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-semibold transition-colors"
          >
            Jogar
          </Link>
        </div>
      </header>

      {/* ========================================================= */}
      {/* TAB 1: SM-2 ERRORS TRAINER                                */}
      {/* ========================================================= */}
      {mainTab === "sm2" && (
        <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-start justify-center">
          {/* Board column */}
          <div className="flex flex-col items-center gap-4 w-full lg:w-auto">
            {currentCard ? (
              <>
                <div className="flex justify-between items-center w-full max-w-[560px] text-xs font-mono text-zinc-400">
                  <span>
                    Vez das:{" "}
                    <strong className="text-amber-400">
                      {sm2Orientation === "white" ? "Brancas" : "Pretas"}
                    </strong>
                  </span>
                  <span>Contexto: {currentCard.context || "Tática"}</span>
                </div>
                <Board
                  fen={currentCard.fen}
                  orientation={sm2Orientation}
                  onMove={handleSm2Move}
                  shape={sm2Shape}
                />
              </>
            ) : (
              <div className="w-full max-w-[560px] aspect-square rounded-2xl border border-zinc-800 bg-zinc-900/40 flex flex-col items-center justify-center p-8 text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Treino em dia!</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                    Você revisou todos os puzzles pendentes para hoje. Suas jogadas com erro em partidas anteriores entrarão na fila espaçada conforme o algoritmo SM-2.
                  </p>
                </div>
                <button
                  onClick={handleSeedExample}
                  className="mt-2 text-xs font-mono px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition-colors"
                >
                  + Adicionar Puzzle de Teste
                </button>
              </div>
            )}
          </div>

          {/* Controls & Progress Column */}
          <div className="w-full lg:w-80 flex flex-col gap-4">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Progresso SM-2</span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Pendentes: {due.length} | Feitos: {doneCount}
                </span>
              </div>

              {currentCard && (
                <>
                  {sm2StatusText && (
                    <div
                      className={`p-3 rounded-xl text-xs font-mono ${
                        isSm2Resolved
                          ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
                          : sm2Attempts > 0
                          ? "bg-rose-950/40 border border-rose-800 text-rose-300"
                          : "bg-amber-950/40 border border-amber-800 text-amber-300"
                      }`}
                    >
                      {sm2StatusText}
                    </div>
                  )}

                  {!isSm2Resolved ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleSm2Hint}
                        disabled={hintUsed}
                        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-amber-300 text-xs font-semibold rounded-xl transition-all border border-zinc-700"
                      >
                        {hintUsed ? "Dica revelada" : "Obter Dica (-1 qualidade)"}
                      </button>
                      <button
                        onClick={handleSm2GiveUp}
                        className="w-full py-2.5 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold rounded-xl transition-all border border-rose-900/40"
                      >
                        Mostrar Resposta (Repetir amanhã)
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleSm2Next}
                      className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg"
                    >
                      Próximo Puzzle →
                    </button>
                  )}

                  <div className="text-[11px] font-mono text-zinc-500 space-y-1 pt-2 border-t border-zinc-800/80">
                    <div>Repetições: {currentCard.reps}</div>
                    <div>Intervalo: {currentCard.interval} dia(s)</div>
                    <div>Fator EF: {currentCard.EF.toFixed(2)}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: OPENING REPERTOIRE & LICHESS EXPLORER              */}
      {/* ========================================================= */}
      {mainTab === "openings" && (
        <div className="w-full max-w-5xl flex flex-col gap-6">
          {/* Controls bar */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase text-zinc-400">Jogando de:</span>
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button
                  onClick={() => handleSelectColor("white")}
                  className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                    selectedColor === "white" ? "bg-amber-600 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Brancas
                </button>
                <button
                  onClick={() => handleSelectColor("black")}
                  className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                    selectedColor === "black" ? "bg-amber-600 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Pretas
                </button>
              </div>

              <span className="text-xs font-mono uppercase text-zinc-400 ml-2">Linha:</span>
              <div className="flex flex-wrap gap-2">
                {(selectedColor === "white" ? repertoireData.white : repertoireData.black).map((l) => (
                  <button
                    key={l.name}
                    onClick={() => handleSelectLine(l)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-all ${
                      activeLine.name === l.name
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase text-zinc-400">Modo:</span>
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button
                  onClick={() => {
                    setOpeningMode("drill");
                    resetDrillLine(activeLine, selectedColor);
                  }}
                  className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                    openingMode === "drill" ? "bg-amber-600 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Treino Guiado
                </button>
                <button
                  onClick={() => {
                    setOpeningMode("explore");
                    setDrillStatus("Modo Explorador ativado. Jogue qualquer lance livremente.");
                  }}
                  className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                    openingMode === "explore" ? "bg-cyan-700 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Explorer (Livre)
                </button>
              </div>

              <button
                onClick={() => resetDrillLine(activeLine, selectedColor)}
                className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
              >
                Reiniciar
              </button>
            </div>
          </div>

          {/* Main workspace for Openings */}
          <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
            {/* Board */}
            <div className="flex flex-col items-center gap-4 w-full lg:w-auto">
              <div className="flex justify-between items-center w-full max-w-[560px] text-xs font-mono text-zinc-400">
                <span>
                  Linha: <strong className="text-amber-400">{activeLine.name}</strong>
                </span>
                <span>
                  Lance teórico: {drillPly} / {activeLine.line.length}
                </span>
              </div>

              <Board
                fen={openingFen}
                orientation={selectedColor}
                onMove={handleOpeningMove}
                shape={openingShape}
              />

              {/* Line move pills */}
              <div className="flex flex-wrap gap-1.5 max-w-[560px] p-2 bg-zinc-900/60 rounded-xl border border-zinc-800">
                {activeLine.line.map((san, idx) => (
                  <span
                    key={idx}
                    className={`text-xs font-mono px-2 py-0.5 rounded ${
                      idx < drillPly
                        ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50"
                        : idx === drillPly
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500 font-bold"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : ""} {san}
                  </span>
                ))}
              </div>
            </div>

            {/* Right details panel */}
            <div className="w-full lg:w-80 flex flex-col gap-4">
              {/* Status card */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  {openingMode === "drill" ? "Status do Treino" : "Explorer Lichess Masters"}
                </span>

                {drillStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs font-mono ${
                      drillCompleted
                        ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
                        : lastDeviationEval
                        ? "bg-rose-950/40 border border-rose-800 text-rose-300"
                        : "bg-amber-950/40 border border-amber-800 text-amber-300"
                    }`}
                  >
                    {drillStatus}
                  </div>
                )}

                {lastDeviationEval && (
                  <div className="text-xs font-mono p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
                    <div className="text-zinc-400">Avaliação da Engine:</div>
                    <div className="text-rose-400 font-bold">Perda: {lastDeviationEval.cpLoss} centipawns</div>
                    <div className="text-zinc-300">Melhor lance: {lastDeviationEval.best}</div>
                  </div>
                )}

                {/* Coach Verdict in Explore mode */}
                {coachExplore && (
                  <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl flex flex-col gap-1.5 text-xs">
                    <span className="text-amber-400 font-bold uppercase text-[10px]">Veredito do GM:</span>
                    <p className="font-semibold text-white">{coachExplore.verdict}</p>
                    <p className="text-zinc-300">{coachExplore.consequences}</p>
                    {coachExplore.namedVariant && (
                      <span className="text-amber-500 font-mono text-[11px] mt-1">
                        Variante: {coachExplore.namedVariant}
                      </span>
                    )}
                  </div>
                )}

                {isExploreLoading && (
                  <div className="text-xs font-mono text-cyan-400 animate-pulse">
                    Consultando base de mestres & Coach...
                  </div>
                )}
              </div>

                {/* Lichess Masters Explorer Table */}
                {(explorerMoves.length > 0 || explorerStats) && (
                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">
                        Base de Mestres (Lichess)
                      </span>
                    </div>

                    {explorerStats && (
                      <div className="text-xs font-mono space-y-1">
                        {explorerStats.opening && (
                          <div className="text-zinc-200 font-bold">
                            {explorerStats.opening.eco} - {explorerStats.opening.name}
                          </div>
                        )}
                        <div className="flex gap-2 text-[11px] text-zinc-400">
                          <span className="text-emerald-400">1-0: {explorerStats.white}</span>
                          <span className="text-zinc-400">½-½: {explorerStats.draws}</span>
                          <span className="text-rose-400">0-1: {explorerStats.black}</span>
                        </div>
                      </div>
                    )}

                    {explorerMoves.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        <span className="text-[11px] font-mono text-zinc-400">Lances mais populares:</span>
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
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
