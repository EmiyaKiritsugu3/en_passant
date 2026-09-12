"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  DEFAULT_PROFILE,
  getProfileSnapshot,
  subscribeProfile,
  type Profile,
} from "@/lib/profile/store";
import {
  EMPTY_CARDS,
  getCardsSnapshot,
  subscribeCards,
  summarizeDue,
} from "@/lib/sm2/scheduler";

export default function DashboardPage() {
  const profile: Profile = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    () => DEFAULT_PROFILE
  );
  const allCards = useSyncExternalStore(subscribeCards, getCardsSnapshot, () => EMPTY_CARDS);
  const due = summarizeDue(allCards);
  const skills = [
    { label: "Tática", value: profile.errorTags.tactics, color: "bg-rose-500" },
    { label: "Seg. do Rei", value: profile.errorTags.kingSafety, color: "bg-amber-500" },
    { label: "Peões", value: profile.errorTags.pawns, color: "bg-sky-500" },
    { label: "Finais", value: profile.errorTags.endgame, color: "bg-indigo-500" },
  ];
  const maxSkill = Math.max(1, ...skills.map((s) => s.value));




  const latestPhases = profile.phaseHistory[profile.phaseHistory.length - 1] ?? {
    opening: 0,
    middlegame: 0,
    endgame: 0,
  };

  const topTags = Object.entries(profile.errorTags)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([tag]) => tag);

  const phaseEntries = [
    { label: "Abertura", score: latestPhases.opening, color: "bg-sky-500" },
    { label: "Meio-jogo", score: latestPhases.middlegame, color: "bg-amber-500" },
    { label: "Final", score: latestPhases.endgame, color: "bg-emerald-500" },
  ];

  const weakestPhase = [...phaseEntries].sort((a, b) => a.score - b.score)[0];

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 p-6 md:p-12 flex justify-center">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-6">
          <div>
            <span className="text-xs uppercase font-mono tracking-widest text-amber-500 font-semibold">
              En Passant Analytics
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-white mt-1">Painel do Aluno</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
            >
              Nova Partida
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-xs text-zinc-400 uppercase font-mono">Rating</span>
            <span className="text-2xl font-bold font-mono text-amber-400">{profile.rating}</span>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-xs text-zinc-400 uppercase font-mono">Partidas</span>
            <span className="text-2xl font-bold font-mono text-zinc-100">{profile.games}</span>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-xs text-zinc-400 uppercase font-mono">Erros Táticos</span>
            <span className="text-2xl font-bold font-mono text-rose-400">{profile.errorTags.tactics}</span>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-xs text-zinc-400 uppercase font-mono">Erros em Finais</span>
            <span className="text-2xl font-bold font-mono text-indigo-400">{profile.errorTags.endgame}</span>
          </div>
        </div>

        {/* Phase Accuracy Bars */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Precisão por Fase (Última Partida)
          </h2>
          <div className="flex flex-col gap-4">
            {phaseEntries.map(({ label, score, color }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-300">{label}</span>
                  <span className="text-amber-400 font-bold">{score}%</span>
                </div>
                <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weakest Phase Recommendation */}
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-6 flex flex-col gap-2">
          <span className="text-xs uppercase font-mono font-bold text-amber-400">Plano de Treino Recomendado</span>
          <p className="text-sm text-amber-200 leading-relaxed">
            Foco prioritário na fase de <strong>{weakestPhase.label}</strong> (precisão {weakestPhase.score}%).
            Seus erros mais frequentes envolvem <strong>#{topTags[0] ?? "tática"}</strong> e{" "}
            <strong>#{topTags[1] ?? "finais"}</strong>. Treine esses conceitos no módulo SM-2 e estude partidas clássicas do tema.
          </p>
        </div>

        {/* Daily Review Card */}
        <Link
          href={due.due > 0 ? "/train" : "/trainer/punishment"}
          className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-6 flex justify-between items-center gap-4 hover:border-amber-700/60 transition-colors"
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase font-mono font-bold text-amber-400">Revisão Diária</span>
            {due.due > 0 ? (
              <p className="text-sm text-amber-200">
                <strong>{due.due} posição{due.due > 1 ? "ões" : ""} pronta{due.due > 1 ? "s" : ""}</strong>
                {due.byContext[0] ? ` — ${due.byContext[0].context}: ${due.byContext[0].due}` : ""} para revisar.
              </p>
            ) : (
              <p className="text-sm text-amber-200">
                Nada pendente. Reforce no <strong>Punishment Lab</strong> e volte amanhã.
              </p>
            )}
            <span className="text-[11px] font-mono text-zinc-500">
              Total: {due.total} · Novas: {due.fresh}
            </span>
          </div>
          <span className="text-xs font-mono px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold shrink-0">
            {due.due > 0 ? "Revisar →" : "Treinar →"}
          </span>
        </Link>

        {/* Skills Radar (error-tag bars) */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Radar de Habilidades (erros acumulados)
          </h2>
          <div className="flex flex-col gap-4">
            {skills.map(({ label, value, color }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-300">{label}</span>
                  <span className="text-amber-400 font-bold">{value}</span>
                </div>
                <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(4, Math.min(100, (value / maxSkill) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* History List */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Histórico de Fases</h2>
          {profile.phaseHistory.length === 0 ? (
            <p className="text-xs text-zinc-500 font-mono">Nenhuma partida finalizada ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-800">
              {profile.phaseHistory.map((item) => (
                <div key={item.game} className="py-3 flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-300 font-semibold">Partida #{item.game}</span>
                  <div className="flex gap-4 text-zinc-400">
                    <span>Ab: {item.opening}%</span>
                    <span>Meio: {item.middlegame}%</span>
                    <span>Fim: {item.endgame}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
