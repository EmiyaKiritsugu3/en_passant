"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import { getDrill, londonDrills } from "@/lib/punishment/london";
import { accepts, hintText, qualityFor, reduce, type LadderStage } from "@/lib/punishment/ladder";
import { addCard } from "@/lib/sm2/scheduler";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";

export default function PunishmentPage() {
  const [drillId, setDrillId] = useState(londonDrills[0].id);
  const drill = getDrill(drillId) ?? londonDrills[0];

  const [stage, setStage] = useState<LadderStage>({ kind: "recognize" });
  const [fen, setFen] = useState(drill.fenBlunder);
  const [attempts, setAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [status, setStatus] = useState("");
  const [shape, setShape] = useState<DrawShape[]>([]);
  const [saved, setSaved] = useState(false);

  const game = useMemo(() => new Chess(drill.fenBlunder), [drill]);
  game.load(fen);

  const selectDrill = (id: string) => {
    const d = getDrill(id) ?? londonDrills[0];
    setDrillId(d.id);
    setStage({ kind: "recognize" });
    setFen(d.fenBlunder);
    setAttempts(0);
    setHintsUsed(0);
    setStatus("");
    setShape([]);
    setSaved(false);
  };

  const handleMove = (from: string, to: string) => {
    if (stage.kind === "done") return;
    const legal = game.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
    if (!legal) return;
    const ok = accepts(drill, legal.san);
    if (stage.kind === "execute") {
      if (ok) {
        game.move(legal.san);
        setFen(game.fen());
        setStage(reduce(stage, { type: "CORRECT" }));
        setShape([{ orig: from as Key, dest: to as Key, brush: "green" }]);
        setStatus("Correto! Lance punitivo executado.");
      } else {
        setAttempts((a) => a + 1);
        setStage(reduce(stage, { type: "WRONG" }));
        setShape([{ orig: from as Key, dest: to as Key, brush: "red" }]);
        setStatus(`Não é esse. Volte às dicas. Esperado envolve: ${drill.triggerType}.`);
      }
    } else if (stage.kind === "hint") {
      if (ok) {
        game.move(legal.san);
        setFen(game.fen());
        setStage(reduce(stage, { type: "CORRECT" }));
        setShape([{ orig: from as Key, dest: to as Key, brush: "green" }]);
        setStatus("Boa descoberta! Agora finalize no estágio de execução.");
      } else {
        setAttempts((a) => a + 1);
        setShape([{ orig: from as Key, dest: to as Key, brush: "red" }]);
        setStatus("Ainda não. Peça outra dica ou tente de novo.");
      }
    }
  };

  const nextHint = () => {
    if (stage.kind !== "hint") return;
    setHintsUsed((h) => h + 1);
    setStage(reduce(stage, { type: "HINT" }));
  };

  const reveal = () => {
    setStage(reduce(stage, { type: "REVEAL" }));
    setStatus(`${drill.punishmentExplanation} Lance: ${drill.idealResponseSan}.`);
    const orig = drill.idealResponseSan.slice(0, 2) as Key;
    setShape([{ orig, dest: orig, brush: "blue" }]);
  };

  const saveSm2 = () => {
    if (stage.kind !== "done") return;
    const q = qualityFor(stage, attempts, hintsUsed);
    addCard({ fen: drill.fenBlunder, bestMove: drill.idealResponseSan, context: drill.variationName });
    setSaved(true);
    setStatus(`Salvo no SM-2 (qualidade ${q}). Revise amanhã.`);
  };

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl flex justify-between items-center gap-4 mb-6 border-b border-zinc-800/80 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-amber-500 font-semibold">
            Punishment Lab
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">London System</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/train" className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
            Treino
          </Link>
          <Link href="/play" className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-semibold">
            Jogar
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 max-w-5xl w-full mb-6">
        {londonDrills.map((d) => (
          <button
            key={d.id}
            onClick={() => selectDrill(d.id)}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold border transition-all ${
              d.id === drillId
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            {d.variationName}
          </button>
        ))}
      </div>

      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-start justify-center">
        <div className="flex flex-col items-center gap-4 w-full lg:w-auto">
          <div className="text-xs font-mono text-zinc-400 w-full max-w-[560px]">
            Erro preto: <strong className="text-rose-400">{drill.opponentMistakeSan}</strong>
            {" · "}Gatilho: {drill.triggerType}
          </div>
          <Board fen={fen} orientation="white" onMove={handleMove} shape={shape} />
        </div>

        <div className="w-full lg:w-80 flex flex-col gap-4">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              {stage.kind === "recognize" && "Estágio 1 — Reconhecimento"}
              {stage.kind === "hint" && `Estágio 2 — Dica ${stage.level}/4`}
              {stage.kind === "execute" && "Estágio 3 — Execução"}
              {stage.kind === "done" && (stage.solved ? "Resolvido" : "Revelado")}
            </span>

            {stage.kind === "recognize" && (
              <>
                <p className="text-sm text-zinc-200">O oponente errou com {drill.opponentMistakeSan}. Você percebeu?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setStage(reduce(stage, { type: "SPOT" })); setStatus("Certo — jogue a punição no tabuleiro."); }}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl"
                  >
                    Vi o erro
                  </button>
                  <button
                    onClick={() => { setStage(reduce(stage, { type: "MISS" })); setStatus(drill.triggerDescription); }}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl border border-zinc-700"
                  >
                    Não vi
                  </button>
                </div>
              </>
            )}

            {stage.kind === "hint" && (
              <>
                <p className="text-sm text-amber-200">{hintText(drill, stage.level)}</p>
                <div className="text-[11px] font-mono text-zinc-500">Jogue no tabuleiro ou peça próxima dica.</div>
                <button
                  onClick={nextHint}
                  disabled={stage.level >= 4}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-amber-300 text-xs font-semibold rounded-xl border border-zinc-700"
                >
                  {stage.level >= 4 ? "Última dica" : "Próxima dica"}
                </button>
              </>
            )}

            {stage.kind === "execute" && (
              <p className="text-sm text-zinc-200">Jogue a punição no tabuleiro.</p>
            )}

            {stage.kind === "done" && (
              <>
                <div className={`p-3 rounded-xl text-xs font-mono ${stage.solved ? "bg-emerald-950/40 border border-emerald-800 text-emerald-300" : "bg-rose-950/40 border border-rose-800 text-rose-300"}`}>
                  {status || drill.punishmentExplanation}
                </div>
                {!saved ? (
                  <button onClick={saveSm2} className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl">
                    Salvar no SM-2 →
                  </button>
                ) : (
                  <button onClick={() => selectDrill(londonDrills[(londonDrills.findIndex((d) => d.id === drillId) + 1) % londonDrills.length].id)} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700">
                    Próximo drill →
                  </button>
                )}
              </>
            )}

            {status && stage.kind !== "done" && (
              <div className="p-3 rounded-xl text-xs font-mono bg-zinc-950 border border-zinc-800 text-zinc-300">
                {status}
              </div>
            )}

            {stage.kind !== "done" && stage.kind !== "recognize" && (
              <button onClick={reveal} className="w-full py-2 bg-transparent hover:bg-rose-950/30 text-rose-400/80 text-[11px] font-mono rounded-xl border border-transparent hover:border-rose-900/40">
                Desistir — mostrar solução
              </button>
            )}

            <div className="text-[11px] font-mono text-zinc-500 pt-2 border-t border-zinc-800/80">
              Tentativas: {attempts} · Dicas: {hintsUsed}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
