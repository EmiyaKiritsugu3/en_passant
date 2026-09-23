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

const TAG_LABELS: Record<string, string> = {
  tactics: "tática",
  kingSafety: "segurança do rei",
  pawns: "peões",
  endgame: "finais",
};

export default function DashboardPage() {
  const profile: Profile = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    () => DEFAULT_PROFILE
  );
  const allCards = useSyncExternalStore(subscribeCards, getCardsSnapshot, () => EMPTY_CARDS);
  const due = summarizeDue(allCards);

  const hasGames = profile.games > 0;

  const latestPhases = profile.phaseHistory[profile.phaseHistory.length - 1] ?? {
    opening: 0,
    middlegame: 0,
    endgame: 0,
  };

  const topTags = Object.entries(profile.errorTags)
    .filter(([, val]) => val > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([tag]) => TAG_LABELS[tag] ?? tag);

  const phaseEntries = [
    { label: "Abertura", score: latestPhases.opening, color: "bg-sky-500" },
    { label: "Meio-jogo", score: latestPhases.middlegame, color: "bg-bronze" },
    { label: "Final", score: latestPhases.endgame, color: "bg-emerald-500" },
  ];

  const weakestPhase = [...phaseEntries].sort((a, b) => a.score - b.score)[0];

  return (
    <main className="min-h-screen bg-noir-bg text-noir-ink flex flex-col items-center select-none pb-12">
      <div className="w-full max-w-lg px-4 pt-8 flex flex-col gap-4">
        <p className="text-[13px] font-semibold text-noir-muted">Você</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Seu progresso</h1>
        <p className="text-[15px] text-noir-muted leading-relaxed">
          Partidas, precisão por fase e o que treinar a seguir.
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-noir-surface border border-noir-line rounded-[20px] p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[13px] text-noir-muted">Pontos</span>
            <span className="text-[22px] font-bold text-bronze">{profile.rating}</span>
          </div>
          <div className="bg-noir-surface border border-noir-line rounded-[20px] p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[13px] text-noir-muted">Partidas</span>
            <span className="text-[22px] font-bold">{profile.games}</span>
          </div>
          <div className="bg-noir-surface border border-noir-line rounded-[20px] p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[13px] text-noir-muted">Aberturas concluídas</span>
            <span className="text-[22px] font-bold text-[#1f7a35]">{Object.keys(profile.openings).length}</span>
          </div>
          <div className="bg-noir-surface border border-noir-line rounded-[20px] p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[13px] text-noir-muted">Revisão pendente</span>
            <span className="text-[22px] font-bold text-bronze">{due.due}</span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="bg-bronze/10 border border-bronze/30 rounded-[20px] p-5 flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-bronze">A seguir</span>
          {!hasGames ? (
            <div className="flex flex-col gap-3">
              <p className="text-[15px] text-noir-ink leading-relaxed">
                Jogue sua primeira partida para receber um plano de treino baseado nos seus erros.
              </p>
              <Link
                href="/play"
                className="text-center py-3.5 px-4 rounded-[14px] bg-bronze text-white text-[17px] font-semibold"
              >
                Jogar agora
              </Link>
            </div>
          ) : (
            <p className="text-[15px] text-noir-ink leading-relaxed">
              Foco em <strong>{weakestPhase.label}</strong> (precisão {weakestPhase.score}%).
              {topTags.length > 0 ? (
                <>
                  {" "}Erros frequentes em <strong>{topTags[0]}</strong>
                  {topTags[1] ? <> e <strong>{topTags[1]}</strong></> : ""}. Revise as posições do dia e jogue a trilha de aberturas.
                </>
              ) : (
                " Continue jogando para identificar padrões."
              )}
            </p>
          )}
        </div>

        {/* Daily Review Card */}
        <Link
          href={due.due > 0 ? "/train" : "/study"}
          className="bg-bronze/10 border border-bronze/30 rounded-[20px] p-5 flex justify-between items-center gap-4"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-bronze">Revisão do dia</span>
            {due.due > 0 ? (
              <p className="text-[15px] text-noir-ink">
                <strong>{due.due} posição{due.due > 1 ? "ões" : ""} pronta{due.due > 1 ? "s" : ""}</strong>
                {due.byContext[0] ? ` — ${due.byContext[0].context}: ${due.byContext[0].due}` : ""} para revisar.
              </p>
            ) : (
              <p className="text-[15px] text-noir-ink">
                Nada pendente. Continue na <strong>trilha de aberturas</strong> e volte amanhã.
              </p>
            )}
            <span className="text-[13px] text-noir-muted">
              Total: {due.total} · Novas: {due.fresh}
            </span>
          </div>
          <span className="text-[15px] font-semibold px-4 py-2.5 rounded-[14px] bg-bronze text-white shrink-0">
            {due.due > 0 ? "Revisar →" : "Aprender →"}
          </span>
        </Link>

        {/* Precision by phase */}
        <div className="bg-noir-surface border border-noir-line rounded-[20px] p-5 flex flex-col gap-4 shadow-sm">
          <h2 className="text-[15px] font-semibold">
            Precisão por fase
          </h2>
          <div className="flex flex-col gap-3">
            {phaseEntries.map(({ label, score }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-noir-muted">{label}</span>
                  <span className="text-bronze font-bold">{score}%</span>
                </div>
                <div className="h-2.5 w-full bg-noir-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-bronze rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Openings progress */}
        <div className="bg-noir-surface border border-noir-line rounded-[20px] p-5 flex flex-col gap-3 shadow-sm">
          <h2 className="text-[15px] font-semibold">Aberturas</h2>
          {Object.keys(profile.openings).length === 0 ? (
            <p className="text-[15px] text-noir-muted leading-relaxed">
              Nenhuma lição concluída ainda. Comece pela trilha de aberturas.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-noir-line">
              {Object.entries(profile.openings).map(([name, count]) => (
                <div key={name} className="py-2.5 flex justify-between items-center text-[15px]">
                  <span className="font-medium">{name}</span>
                  <span className="text-[13px] text-noir-muted">{count}x</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/" className="text-center py-3 rounded-[14px] bg-noir-raised text-[15px] font-semibold">
            Ver trilha
          </Link>
        </div>

        {/* Phase history */}
        <div className="bg-noir-surface border border-noir-line rounded-[20px] p-5 flex flex-col gap-3 shadow-sm">
          <h2 className="text-[15px] font-semibold">Últimas partidas</h2>
          {profile.phaseHistory.length === 0 ? (
            <p className="text-[15px] text-noir-muted">Nenhuma partida finalizada ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-noir-line">
              {profile.phaseHistory.slice(-5).reverse().map((item) => (
                <div key={item.game} className="py-2.5 flex justify-between items-center text-[13px]">
                  <span className="text-noir-muted font-medium">Partida #{item.game}</span>
                  <div className="flex gap-3 text-noir-muted">
                    <span>Ab {item.opening}%</span>
                    <span>Me {item.middlegame}%</span>
                    <span>Fi {item.endgame}%</span>
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
