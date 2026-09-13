"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_PROFILE, getProfileSnapshot, subscribeProfile } from "@/lib/profile/store";
import { EMPTY_CARDS, getCardsSnapshot, subscribeCards, summarizeDue } from "@/lib/sm2/scheduler";
import { Dices } from "lucide-react";
import moduleData from "@/data/home-modules.json";

interface Module {
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  href: string;
  icon: string;
  actionLabel: string;
}

const MODULES: Module[] = moduleData as Module[];

export default function Setup() {
  const router = useRouter();
  const profile = useSyncExternalStore(subscribeProfile, getProfileSnapshot, () => DEFAULT_PROFILE);
  const cards = useSyncExternalStore(subscribeCards, getCardsSnapshot, () => EMPTY_CARDS);
  const due = summarizeDue(cards);

  const go = (side: string) => {
    const chosen = side === "random" ? (Math.random() < 0.5 ? "white" : "black") : side;
    router.push(`/play?side=${chosen}`);
  };

  return (
    <main className="min-h-screen bg-noir-bg text-noir-ink flex flex-col items-center select-none pb-12">
      {/* ================= TOPBAR NAVIGATION ================= */}
      <header className="w-full max-w-7xl px-4 py-3 flex items-center justify-between border-b border-noir-line bg-noir-surface/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-bronze font-bold tracking-wider text-xs uppercase font-display">
            En Passant
          </span>
          <span className="text-noir-muted text-xs">•</span>
          <span className="text-xs font-semibold text-noir-ink">Command Center</span>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg bg-noir-raised border border-noir-line text-noir-muted hover:text-bronze hover:border-noir-line transition-colors"
          >
            Painel
          </Link>
          <Link
            href="/trainer/punishment"
            className="px-3 py-1.5 rounded-lg bg-noir-raised border border-noir-line text-noir-muted hover:text-bronze hover:border-noir-line transition-colors hidden sm:inline"
          >
            Trap Lab
          </Link>
          <Link
            href="/train"
            className="px-3 py-1.5 rounded-lg bg-noir-raised border border-noir-line text-noir-muted hover:text-bronze hover:border-noir-line transition-colors hidden md:inline"
          >
            Treino SM-2
          </Link>
          <Link
            href="/study"
            className="px-3 py-1.5 rounded-lg bg-noir-raised border border-noir-line text-noir-muted hover:text-bronze hover:border-noir-line transition-colors hidden lg:inline"
          >
            Estudo
          </Link>
          <Link
            href="/library"
            className="px-3 py-1.5 rounded-lg bg-noir-raised border border-noir-line text-noir-muted hover:text-bronze hover:border-noir-line transition-colors hidden lg:inline"
          >
            Biblioteca
          </Link>
        </nav>
      </header>

      {/* ================= HERO & QUICK MATCH ================= */}
      <section className="w-full max-w-5xl px-4 pt-8 pb-6 flex flex-col md:flex-row gap-6 items-stretch justify-center">
        {/* Quick Side Selection Box (preserved for exact test compatibility) */}
        <div className="w-full md:w-[420px] bg-noir-surface border border-noir-line rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase text-bronze font-mono font-semibold">
              Partida Guiada
            </span>
            <h1 className="text-xl font-bold tracking-tight font-display text-noir-ink">
              Nova Partida na Arena GM
            </h1>
            <p className="text-xs text-noir-muted leading-relaxed">
              Escolha seu lado para iniciar o confronto com análise socrática em tempo real.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => go("white")}
              className="w-full py-3 px-4 rounded-xl bg-noir-raised hover:bg-noir-line active:scale-[0.99] border border-noir-line text-noir-ink font-medium flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-noir-ink border border-noir-line shadow-sm" />
                <span className="text-sm font-semibold">1. White</span>
              </div>
              <span className="text-xs text-noir-muted font-mono">Você joga primeiro</span>
            </button>

            <button
              type="button"
              onClick={() => go("black")}
              className="w-full py-3 px-4 rounded-xl bg-noir-raised hover:bg-noir-line active:scale-[0.99] border border-noir-line text-noir-ink font-medium flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-noir-bg border border-noir-line shadow-sm" />
                <span className="text-sm font-semibold">2. Black</span>
              </div>
              <span className="text-xs text-noir-muted font-mono">Stockfish joga primeiro</span>
            </button>

            <button
              type="button"
              onClick={() => go("random")}
              className="w-full py-3 px-4 rounded-xl bg-bronze/20 hover:bg-bronze/30 text-bronze active:scale-[0.99] border border-bronze/40 font-medium flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <Dices size={14} />
                <span className="text-sm font-semibold">3. Random</span>
              </div>
              <span className="text-xs text-bronze/80 font-mono">Cor aleatória</span>
            </button>
          </div>
        </div>

        {/* Student Quick Status & Snapshot */}
        <div className="flex-1 bg-noir-surface/60 border border-noir-line rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase text-bronze font-mono font-semibold">
              Perfil do Jogador
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-noir-ink">
                {profile.rating} <span className="text-xs text-noir-muted">Rating ELO</span>
              </span>
              <span className="text-xs font-mono text-noir-muted">
                {profile.games} {profile.games === 1 ? "partida jogada" : "partidas jogadas"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-noir-bg/60 border border-noir-line rounded-xl p-3 flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-mono text-noir-muted">Revisão SM-2</span>
              <span className="text-sm font-bold font-mono text-bronze">
                {due.due > 0 ? `${due.due} pendente${due.due > 1 ? "s" : ""}` : "Em dia"}
              </span>
            </div>
            <div className="bg-noir-bg/60 border border-noir-line rounded-xl p-3 flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-mono text-noir-muted">Erros Táticos</span>
              <span className="text-sm font-bold font-mono text-rose-400">
                {profile.errorTags.tactics} registrados
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Link
              href="/dashboard"
              className="flex-1 text-center py-2.5 px-4 rounded-xl bg-bronze-deep hover:bg-bronze text-white font-mono text-xs font-bold transition-colors"
            >
              Abrir Painel Completo →
            </Link>
            <Link
              href="/trainer/punishment"
              className="flex-1 text-center py-2.5 px-4 rounded-xl bg-noir-raised hover:bg-noir-line text-noir-muted font-mono text-xs font-semibold border border-noir-line transition-colors"
            >
              Trap Lab (Punições)
            </Link>
          </div>
        </div>
      </section>

      {/* ================= COMMAND CENTER MODULES ================= */}
      <section className="w-full max-w-5xl px-4 mt-4">
        <div className="flex items-center justify-between mb-4 border-b border-noir-line pb-2">
          <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-noir-muted">
            Módulos de Treinamento
          </h2>
          <span className="text-xs text-noir-muted font-mono">5 módulos integrados</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className="bg-noir-surface/70 border border-noir-line hover:border-bronze/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 group hover:shadow-lg hover:shadow-bronze/5 hover:-translate-y-0.5"
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{m.icon}</span>
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${m.badgeColor}`}>
                    {m.badge}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-noir-ink group-hover:text-bronze transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-xs text-noir-muted leading-relaxed mt-1">
                    {m.description}
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-semibold text-bronze group-hover:translate-x-1 transition-transform flex items-center gap-1">
                {m.actionLabel} <span>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
