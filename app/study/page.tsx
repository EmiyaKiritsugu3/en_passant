"use client";

import { Suspense, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import { checkDrillMove } from "@/lib/repertoire/drill";
import {
  DEFAULT_PROFILE,
  getProfileSnapshot,
  saveProfile,
  subscribeProfile,
} from "@/lib/profile/store";
import repertoireData from "@/data/repertoire.json";
import type { DrawShape } from "chessgroundx/draw";
import type { Key } from "chessgroundx/types";
import { ChevronRight, Lightbulb, RotateCcw, Trophy } from "lucide-react";
import { playLessonCompleteSound } from "@/lib/sound/audio";
import { streakLabel, touchStreak, isStreakActive } from "@/lib/profile/update";

interface Trap {
  name: string;
  mistake: string;
  setup: string[];
  solution: string[];
  punish: string;
  why: string;
}

interface Line {
  name: string;
  line: string[];
  ideas?: string[];
  notes?: string[];
  traps?: Trap[];
}

interface Opening {
  name: string;
  eco: string;
  variations: Line[];
}

type Step = "idea" | "drill" | "hunt" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "idea", label: "Ideia" },
  { key: "drill", label: "Linha" },
  { key: "hunt", label: "Caça-erro" },
];

function findOpening(name: string | null): { opening: Opening; color: "white" | "black" } {
  const all = [
    ...(repertoireData.white as Opening[]).map((o) => ({ o, c: "white" as const })),
    ...(repertoireData.black as Opening[]).map((o) => ({ o, c: "black" as const })),
  ];
  const hit = name ? all.find(({ o }) => o.name === name) : undefined;
  return hit ? { opening: hit.o, color: hit.c } : { opening: repertoireData.white[0] as Opening, color: "white" };
}

function StudyLesson() {
  const searchParams = useSearchParams();
  const initial = useMemo(() => findOpening(searchParams.get("opening")), [searchParams]);

  const profile = useSyncExternalStore(subscribeProfile, getProfileSnapshot, () => DEFAULT_PROFILE);
  const [color, setColor] = useState<"white" | "black">(initial.color);
  const [openingName, setOpeningName] = useState(initial.opening.name);
  const [lineName, setLineName] = useState(initial.opening.variations[0].name);
  const [step, setStep] = useState<Step>("idea");

  const openings = (color === "white" ? repertoireData.white : repertoireData.black) as Opening[];
  const opening = openings.find((o) => o.name === openingName) ?? openings[0];
  const line = opening.variations.find((v) => v.name === lineName) ?? opening.variations[0];
  const trap = line.traps?.[0] ?? null;

  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(game.fen());
  const [ply, setPly] = useState(0);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [shape, setShape] = useState<DrawShape[]>([]);
  const [completed, setCompleted] = useState(false);
  const [huntColor, setHuntColor] = useState<"white" | "black">("white");
  const huntIdRef = useRef(0);
  // Timers do drill respondem na posição compartilhada `game`: sem guarda, um
  // auto-reply agendado antes de "Reiniciar" cai no tabuleiro zerado e
  // dessincroniza fen/ply/status. O hunt já usa huntIdRef; o drill usa este.
  const drillIdRef = useRef(0);

  const selectOpening = (o: Opening) => {
    setOpeningName(o.name);
    setLineName(o.variations[0].name);
    setStep("idea");
    resetBoard();
  };

  const selectColor = (c: "white" | "black") => {
    setColor(c);
    const list = (c === "white" ? repertoireData.white : repertoireData.black) as Opening[];
    setOpeningName(list[0].name);
    setLineName(list[0].variations[0].name);
    setStep("idea");
    resetBoard();
  };

  const selectLine = (l: Line) => {
    setLineName(l.name);
    setStep("idea");
    resetBoard();
  };

  function resetBoard() {
    drillIdRef.current += 1;
    game.reset();
    setFen(game.fen());
    setPly(0);
    setNote("");
    setStatus("");
    setShape([]);
    setCompleted(false);
  }

  function startDrill() {
    resetBoard();
    const id = drillIdRef.current;
    setStep("drill");
    setStatus("Sua vez de jogar a linha.");
    if (color === "black" && line.line.length > 0) {
      setTimeout(() => {
        if (drillIdRef.current !== id) return;
        try {
          game.move(line.line[0]);
          setFen(game.fen());
          setPly(1);
        } catch {}
      }, 300);
    }
  }

  function handleDrillMove(from: string, to: string) {
    const legal = game.moves({ verbose: true });
    const move = legal.find((m) => m.from === from && m.to === to);
    if (!move) return;
    const id = drillIdRef.current;
    const check = checkDrillMove(line.line, ply, move.san);
    if (!check.ok) {
      setShape([{ orig: from as Key, dest: to as Key, brush: "red" }]);
      setStatus(`Não é esse. O esperado aqui é ${check.expected}.`);
      return;
    }
    game.move(move.san);
    setFen(game.fen());
    setShape([]);
    setNote(line.notes?.[ply] ?? "");
    const next = ply + 1;
    setPly(next);
    if (next >= line.line.length) {
      setCompleted(true);
      setStatus("Linha completa! Agora caça o erro.");
      return;
    }
    const oppColor = color === "white" ? "b" : "w";
    if (game.turn() === oppColor) {
      setStatus("Adversário respondendo...");
      const oppSan = line.line[next];
      setTimeout(() => {
        if (drillIdRef.current !== id) return;
        try {
          game.move(oppSan);
          setFen(game.fen());
          const after = next + 1;
          setPly(after);
          setNote(line.notes?.[next] ?? "");
          if (after >= line.line.length) {
            setCompleted(true);
            setStatus("Linha completa! Agora caça o erro.");
          } else {
            setStatus("Sua vez.");
          }
        } catch {}
      }, 400);
    } else {
      setStatus("Correto! Continue.");
    }
  }

  function startHunt() {
    if (!trap) {
      finishLesson();
      return;
    }
    const id = ++huntIdRef.current;
    game.reset();
    try {
      for (const san of trap.setup) game.move(san);
    } catch {
      setStatus("Posição inválida.");
      return;
    }
    if (huntIdRef.current !== id) return;
    setFen(game.fen());
    // O hunt mostra o lado a jogar (algumas armadilhas pretas punem com as
    // brancas): sem isso, o tabuleiro fica sem destinos e a lição trava.
    setHuntColor(game.turn() === "w" ? "white" : "black");
    setPly(0);
    setShape([]);
    setCompleted(false);
    setStep("hunt");
    setStatus(`As ${game.turn() === "w" ? "pretas" : "brancas"} erraram com ${trap.mistake}. Encontre a punição!`);
  }

  function handleHuntMove(from: string, to: string) {
    if (!trap || completed) return;
    const id = huntIdRef.current;
    const legal = game.moves({ verbose: true });
    const move = legal.find((m) => m.from === from && m.to === to);
    if (!move) return;
    if (move.san !== trap.solution[ply]) {
      setShape([{ orig: from as Key, dest: to as Key, brush: "red" }]);
      setStatus(`Não é esse. O erro ${trap.mistake} deixou algo pendurado — procure o golpe.`);
      return;
    }
    game.move(move.san);
    setFen(game.fen());
    setShape([{ orig: from as Key, dest: to as Key, brush: "green" }]);
    const next = ply + 1;
    setPly(next);
    if (next >= trap.solution.length) {
      setCompleted(true);
      setStatus(`Punição executada! ${trap.why}`);
      return;
    }
    setStatus("Correto! O adversário responde...");
    setTimeout(() => {
      if (huntIdRef.current !== id) return;
      try {
        game.move(trap.solution[next]);
        setFen(game.fen());
        const after = next + 1;
        setPly(after);
        if (after >= trap.solution.length) {
          setCompleted(true);
          setStatus(`Punição executada! ${trap.why}`);
        } else {
          setStatus("Sua vez de novo.");
        }
      } catch {}
    }, 400);
  }

  function finishLesson() {
    const next = touchStreak({
      ...profile,
      openings: { ...profile.openings, [opening.name]: (profile.openings[opening.name] ?? 0) + 1 },
    });
    saveProfile(next);
    playLessonCompleteSound();
    setStep("done");
  }

  const stepIndex = STEPS.findIndex((s) => s.key === (step === "done" ? "hunt" : step));

  return (
    <main className="min-h-screen bg-noir-bg text-noir-ink flex flex-col items-center select-none pb-12">
      <div className="w-full max-w-lg px-4 pt-8 flex flex-col gap-4">
        <Link href="/" className="text-[15px] font-medium text-bronze w-fit">
          ← Trilha
        </Link>
        <div>
          <p className="text-[13px] font-semibold text-noir-muted">
            {opening.eco} · {color === "white" ? "Brancas" : "Pretas"}
          </p>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{opening.name}</h1>
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Cor">
          {(["white", "black"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={color === c}
              onClick={() => selectColor(c)}
              className={`flex-1 py-2.5 rounded-[14px] text-[15px] font-semibold ${
                color === c ? "bg-bronze text-white" : "bg-noir-surface border border-noir-line text-noir-ink"
              }`}
            >
              {c === "white" ? "Brancas" : "Pretas"}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Aberturas">
          {openings.map((o) => (
            <button
              key={o.name}
              type="button"
              onClick={() => selectOpening(o)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-[15px] font-medium border ${
                o.name === opening.name
                  ? "bg-bronze/10 border-bronze/40 text-bronze"
                  : "bg-noir-surface border-noir-line text-noir-muted"
              }`}
            >
              {o.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Linhas">
          {opening.variations.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => selectLine(v)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold border ${
                v.name === line.name
                  ? "bg-noir-ink text-noir-bg border-noir-ink"
                  : "bg-noir-surface border-noir-line text-noir-muted"
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>

        <ol className="flex gap-1.5" aria-label="Progresso da lição">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex-1 flex flex-col gap-1">
              <span
                className={`h-1.5 rounded-full ${i <= stepIndex || step === "done" ? "bg-bronze" : "bg-noir-raised"}`}
              />
              <span className={`text-[11px] font-medium ${i === stepIndex && step !== "done" ? "text-bronze" : "text-noir-muted"}`}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>

        {step === "idea" && (
          <div className="bg-noir-surface rounded-[20px] border border-noir-line p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-bronze" />
              <span className="text-[15px] font-semibold">{line.name} — a ideia</span>
            </div>
            <ul className="flex flex-col gap-2 text-[15px] text-noir-ink leading-relaxed list-disc pl-5">
              {(line.ideas ?? []).map((idea, i) => (
                <li key={i}>{idea}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={startDrill}
              className="mt-1 w-full py-3.5 rounded-[14px] bg-bronze text-white text-[17px] font-semibold flex items-center justify-center gap-1"
            >
              Jogar a linha <ChevronRight size={18} />
            </button>
          </div>
        )}

        {(step === "drill" || step === "hunt") && (
          <>
            <div className="flex justify-between text-[13px] text-noir-muted">
              <span>{step === "drill" ? `Lance ${Math.min(ply + 1, line.line.length)} de ${line.line.length}` : trap?.name}</span>
              <button type="button" onClick={step === "drill" ? startDrill : startHunt} className="flex items-center gap-1 font-medium text-bronze">
                <RotateCcw size={13} /> Reiniciar
              </button>
            </div>
            <div className="bg-noir-surface rounded-[20px] border border-noir-line p-3 shadow-sm">
              <Board
                fen={fen}
                orientation={step === "hunt" ? huntColor : color}
                onMove={step === "drill" ? handleDrillMove : handleHuntMove}
                shape={shape}
              />
            </div>
            {step === "drill" && (
              <div className="flex flex-wrap gap-1.5" aria-label="Lances da linha">
                {line.line.map((san, idx) => (
                  <span
                    key={idx}
                    className={`text-[13px] px-2 py-0.5 rounded-md ${
                      idx < ply ? "bg-[#34c759]/15 text-[#34c759]" : idx === ply ? "bg-bronze/15 text-bronze font-bold" : "bg-noir-raised text-noir-muted"
                    }`}
                  >
                    {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : ""} {san}
                  </span>
                ))}
              </div>
            )}
            {(status || note) && (
              <div className="bg-noir-surface rounded-[20px] border border-noir-line p-4 flex flex-col gap-1.5">
                {status && <p className="text-[15px] font-medium">{status}</p>}
                {note && step === "drill" && <p className="text-[13px] text-noir-muted leading-relaxed">{note}</p>}
              </div>
            )}
            {step === "drill" && completed && (
              <button
                type="button"
                onClick={startHunt}
                className="w-full py-3.5 rounded-[14px] bg-bronze text-white text-[17px] font-semibold flex items-center justify-center gap-1"
              >
                {trap ? "Caçar o erro" : "Concluir lição"} <ChevronRight size={18} />
              </button>
            )}
            {step === "hunt" && completed && (
              <button
                type="button"
                onClick={finishLesson}
                className="w-full py-3.5 rounded-[14px] bg-bronze text-white text-[17px] font-semibold flex items-center justify-center gap-1"
              >
                Concluir lição <ChevronRight size={18} />
              </button>
            )}
          </>
        )}

        {step === "done" && (
          <div className="bg-noir-surface rounded-[20px] border border-noir-line p-8 flex flex-col items-center gap-3 text-center shadow-sm">
            <span className="w-12 h-12 rounded-full bg-bronze/15 flex items-center justify-center text-bronze">
              <Trophy size={22} />
            </span>
            <p className="text-[20px] font-bold">Lição concluída!</p>
            <p className="text-[15px] text-noir-muted">{opening.name} — {line.name} registrada no seu progresso.</p>
            {profile.streak.count > 0 && isStreakActive(profile.streak.lastDay) && (
              <p className="text-[15px] font-semibold text-bronze">🔥 {streakLabel(profile.streak.count)}</p>
            )}
            <Link href="/" className="mt-1 w-full py-3.5 rounded-[14px] bg-bronze text-white text-[17px] font-semibold text-center">
              Próxima abertura
            </Link>
            <Link href={`/play?side=${color}`} className="text-[15px] font-medium text-bronze py-1">
              Praticar em partida
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-noir-bg flex items-center justify-center text-noir-muted text-[13px]">
          Carregando lição...
        </div>
      }
    >
      <StudyLesson />
    </Suspense>
  );
}

// ponytail: lesson = ideas + drill + hunt only. Explorer table + coach comments removed; re-add as "Aprofundar" step when needed.
