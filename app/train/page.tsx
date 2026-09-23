"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Board from "@/components/Board";
import {
  dueCards,
  reviewCard,
  saveCards,
  subscribeCards,
  getCardsSnapshot,
  type Card,
} from "@/lib/sm2/scheduler";
import {
  DEFAULT_PROFILE,
  getProfileSnapshot,
  saveProfile,
  subscribeProfile,
} from "@/lib/profile/store";
import { streakLabel, touchStreak } from "@/lib/profile/update";
import { playLessonCompleteSound } from "@/lib/sound/audio";
import type { DrawShape } from "chessgroundx/draw";
import type { Key } from "chessgroundx/types";
import { CircleCheck } from "lucide-react";

const EMPTY_CARDS: Card[] = [];

export default function ReviewPage() {
  const allCards = useSyncExternalStore(subscribeCards, getCardsSnapshot, () => EMPTY_CARDS);
  const profile = useSyncExternalStore(subscribeProfile, getProfileSnapshot, () => DEFAULT_PROFILE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [isResolved, setIsResolved] = useState(false);
  const [shape, setShape] = useState<DrawShape[]>([]);
  const celebratedRef = useRef(false);

  const due = dueCards(allCards);

  // Clearing the whole daily queue is the win: fanfare + streak, once.
  useEffect(() => {
    if (due.length === 0 && doneCount > 0 && !celebratedRef.current) {
      celebratedRef.current = true;
      saveProfile(touchStreak(getProfileSnapshot()));
      playLessonCompleteSound();
    }
  }, [due.length, doneCount]);
  const currentCard: Card | undefined = due[currentIndex];
  const orientation: "white" | "black" =
    currentCard && currentCard.fen.split(" ")[1] === "b" ? "black" : "white";

  const [prevCardId, setPrevCardId] = useState<string | undefined>(currentCard?.id);
  if (currentCard?.id !== prevCardId) {
    setPrevCardId(currentCard?.id);
    setHintUsed(false);
    setAttempts(0);
    setStatusText("");
    setIsResolved(false);
    setShape([]);
  }

  const handleMove = (from: string, to: string) => {
    if (!currentCard || isResolved) return;
    const uciMove = `${from}${to}`.toLowerCase();
    const expected = currentCard.bestMove.toLowerCase();
    if (expected.startsWith(uciMove)) {
      const quality = attempts === 0 ? (hintUsed ? 4 : 5) : 2;
      const updated = reviewCard(currentCard, quality);
      saveCards(allCards.map((c) => (c.id === currentCard.id ? updated : c)));
      setStatusText("Correto! Excelente resolução.");
      setIsResolved(true);
      setShape([{ orig: from as Key, dest: to as Key, brush: "green" }]);
      setDoneCount((p) => p + 1);
    } else {
      setAttempts((p) => p + 1);
      setStatusText("Ainda não. Calcule outra jogada.");
      setShape([{ orig: from as Key, dest: to as Key, brush: "red" }]);
    }
  };

  const handleHint = () => {
    if (!currentCard || isResolved) return;
    setHintUsed(true);
    const origin = currentCard.bestMove.slice(0, 2) as Key;
    setShape([{ orig: origin, dest: origin, brush: "yellow" }]);
    setStatusText(`Dica: a peça chave está na casa ${origin.toUpperCase()}.`);
  };

  const handleGiveUp = () => {
    if (!currentCard || isResolved) return;
    const updated = reviewCard(currentCard, 0);
    saveCards(allCards.map((c) => (c.id === currentCard.id ? updated : c)));
    setIsResolved(true);
    const orig = currentCard.bestMove.slice(0, 2) as Key;
    const dest = currentCard.bestMove.slice(2, 4) as Key;
    setShape([{ orig, dest, brush: "blue" }]);
    setStatusText(`Solução: ${currentCard.bestMove.toUpperCase()}.`);
    setDoneCount((p) => p + 1);
  };

  const handleNext = () => {
    setHintUsed(false);
    setAttempts(0);
    setStatusText("");
    setIsResolved(false);
    setShape([]);
    setCurrentIndex((i) => (i >= due.length - 1 ? 0 : i + 1));
  };

  return (
    <main className="min-h-screen bg-noir-bg text-noir-ink flex flex-col items-center select-none pb-12">
      <div className="w-full max-w-lg px-4 pt-8 flex flex-col gap-4">
        <p className="text-[13px] font-semibold text-noir-muted">Revisar</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Revisão do dia</h1>
        <p className="text-[15px] text-noir-muted">
          {due.length > 0
            ? `${due.length} posição${due.length > 1 ? "ões" : ""} para revisar`
            : "Nada pendente. Volte amanhã."}
        </p>

        {currentCard ? (
          <>
            <div className="flex justify-between text-[13px] text-noir-muted">
              <span>
                Vez das <strong className="text-bronze">{orientation === "white" ? "brancas" : "pretas"}</strong>
              </span>
              <span>{currentCard.context || "Tática"}</span>
            </div>
            <div className="bg-noir-surface rounded-[20px] border border-noir-line p-3 shadow-sm">
              <Board fen={currentCard.fen} orientation={orientation} onMove={handleMove} shape={shape} />
            </div>
            {statusText && (
              <div
                className={`p-4 rounded-[20px] text-[15px] ${
                  isResolved
                    ? "bg-[#34c759]/10 border border-[#34c759]/30 text-noir-ink"
                    : attempts > 0
                      ? "bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-noir-ink"
                      : "bg-noir-surface border border-noir-line text-noir-muted"
                }`}
              >
                {statusText}
              </div>
            )}
            {!isResolved ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={hintUsed}
                  className="w-full py-3.5 rounded-[14px] bg-noir-surface border border-noir-line text-bronze text-[17px] font-semibold disabled:opacity-40"
                >
                  {hintUsed ? "Dica revelada" : "Dica"}
                </button>
                <button
                  type="button"
                  onClick={handleGiveUp}
                  className="w-full py-3 text-[15px] font-medium text-noir-muted"
                >
                  Mostrar resposta
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3.5 rounded-[14px] bg-bronze text-white text-[17px] font-semibold"
              >
                Próxima →
              </button>
            )}
            <p className="text-[13px] text-noir-muted text-center">
              Feitas: {doneCount} · Revisão de hoje
            </p>
          </>
        ) : (
          <div className="bg-noir-surface rounded-[20px] border border-noir-line p-8 flex flex-col items-center gap-3 text-center shadow-sm">
            <span className="w-12 h-12 rounded-full bg-[#34c759]/15 flex items-center justify-center text-[#34c759]">
              <CircleCheck size={22} />
            </span>
            <p className="text-[17px] font-semibold">Tudo em dia!</p>
            {profile.streak.count > 0 && (
              <p className="text-[15px] font-semibold text-bronze">🔥 {streakLabel(profile.streak.count)}</p>
            )}
            <p className="text-[15px] text-noir-muted">
              Seus erros de partidas entram aqui automaticamente para revisão espaçada.
            </p>
            <Link href="/" className="mt-1 w-full py-3.5 rounded-[14px] bg-bronze text-white text-[17px] font-semibold text-center">
              Aprender abertura
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

// ponytail: review-only flow. Openings drill/explore/hunt moved to /study lesson flow.
