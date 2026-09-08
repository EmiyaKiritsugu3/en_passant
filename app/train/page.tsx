"use client";

import { useState } from "react";
import Link from "next/link";
import Board from "@/components/Board";
import {
  dueCards,
  loadCards,
  reviewCard,
  saveCards,
  addCard,
  type Card,
} from "@/lib/sm2/scheduler";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";

export default function TrainPage() {
  const [allCards, setAllCards] = useState<Card[]>(() => loadCards());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [isResolved, setIsResolved] = useState(false);
  const [shape, setShape] = useState<DrawShape[]>([]);

  const due = dueCards(allCards);
  const currentCard: Card | undefined = due[currentIndex];

  const orientation: "white" | "black" =
    currentCard && currentCard.fen.split(" ")[1] === "b" ? "black" : "white";

  const handleMove = (from: string, to: string) => {
    if (!currentCard || isResolved) return;

    const uciMove = `${from}${to}`.toLowerCase();
    const expected = currentCard.bestMove.toLowerCase();
    const isCorrect = expected.startsWith(uciMove);

    if (isCorrect) {
      const quality = attempts === 0 ? (hintUsed ? 4 : 5) : 2;
      const updatedCard = reviewCard(currentCard, quality);
      const nextAll = allCards.map((c) => (c.id === currentCard.id ? updatedCard : c));
      saveCards(nextAll);
      setAllCards(nextAll);

      setStatusText("Correto! Excelente resolução tática.");
      setIsResolved(true);
      setShape([
        {
          orig: from as Key,
          dest: to as Key,
          brush: "green",
        },
      ]);
      setDoneCount((prev) => prev + 1);
    } else {
      setAttempts((prev) => prev + 1);
      setStatusText("Lance impreciso ou incorreto. Tente calcular outra jogada.");
      setShape([
        {
          orig: from as Key,
          dest: to as Key,
          brush: "red",
        },
      ]);
    }
  };

  const handleHint = () => {
    if (!currentCard || isResolved) return;
    setHintUsed(true);
    const originSquare = currentCard.bestMove.slice(0, 2) as Key;
    setShape([
      {
        orig: originSquare,
        dest: originSquare,
        brush: "yellow",
      },
    ]);
    setStatusText(`Dica: A peça chave a mover está na casa ${originSquare.toUpperCase()}.`);
  };

  const handleGiveUp = () => {
    if (!currentCard || isResolved) return;
    const updatedCard = reviewCard(currentCard, 0);
    const nextAll = allCards.map((c) => (c.id === currentCard.id ? updatedCard : c));
    saveCards(nextAll);
    setAllCards(nextAll);

    setIsResolved(true);
    const orig = currentCard.bestMove.slice(0, 2) as Key;
    const dest = currentCard.bestMove.slice(2, 4) as Key;
    setShape([
      {
        orig,
        dest,
        brush: "blue",
      },
    ]);
    setStatusText(`Solução: o melhor lance era ${currentCard.bestMove.toUpperCase()}.`);
    setDoneCount((prev) => prev + 1);
  };

  const handleNext = () => {
    setHintUsed(false);
    setAttempts(0);
    setStatusText("");
    setIsResolved(false);
    setShape([]);
    if (currentIndex >= due.length - 1) {
      setCurrentIndex(0);
    }
  };

  const handleSeedExample = () => {
    // Scholar's mate blunder example: white queen on h5, black f7 pawn under attack
    addCard({
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
      bestMove: "h5f7",
      context: "Abertura - Tática de mate em 1 lance",
    });
    setAllCards(loadCards());
  };

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8 border-b border-zinc-800/80 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-amber-500 font-semibold">
            Treinador Espaçado SM-2
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Erros Próprios & Táticas</h1>
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
            className="text-xs font-mono px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            Jogar Partida
          </Link>
        </div>
      </header>

      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* Board column */}
        <div className="flex flex-col items-center gap-4 w-full lg:w-auto">
          {currentCard ? (
            <>
              <div className="flex justify-between items-center w-full max-w-[560px] text-xs font-mono text-zinc-400">
                <span>Vez das: <strong className="text-amber-400">{orientation === "white" ? "Brancas" : "Pretas"}</strong></span>
                <span>Contexto: {currentCard.context || "Tática"}</span>
              </div>
              <Board
                fen={currentCard.fen}
                orientation={orientation}
                onMove={handleMove}
                shape={shape}
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
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Progresso</span>
              <span className="text-xs font-mono font-bold text-amber-400">
                Pendentes: {due.length} | Feitos: {doneCount}
              </span>
            </div>

            {currentCard && (
              <>
                {statusText && (
                  <div
                    className={`p-3 rounded-xl text-xs font-mono ${
                      isResolved
                        ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
                        : attempts > 0
                        ? "bg-rose-950/40 border border-rose-800 text-rose-300"
                        : "bg-amber-950/40 border border-amber-800 text-amber-300"
                    }`}
                  >
                    {statusText}
                  </div>
                )}

                {!isResolved ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleHint}
                      disabled={hintUsed}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-amber-300 text-xs font-semibold rounded-xl transition-all border border-zinc-700"
                    >
                      {hintUsed ? "Dica revelada" : "Obter Dica (-1 qualidade)"}
                    </button>
                    <button
                      onClick={handleGiveUp}
                      className="w-full py-2.5 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold rounded-xl transition-all border border-rose-900/40"
                    >
                      Mostrar Resposta (Repetir amanhã)
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleNext}
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
    </main>
  );
}
