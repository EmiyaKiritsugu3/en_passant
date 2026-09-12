"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_PROFILE, getProfileSnapshot, subscribeProfile } from "@/lib/profile/store";
import { EMPTY_CARDS, getCardsSnapshot, subscribeCards, summarizeDue } from "@/lib/sm2/scheduler";
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
    <main className="min-h-screen bg-[#161512] text-zinc-100 flex flex-col items-center select-none pb-12">
      {/* ================= TOPBAR NAVIGATION ================= */}
      <header className="w-full max-w-7xl px-4 py-3 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 font-bold tracking-wider text-xs uppercase font-mono">
            En Passant
          </span>
          <span className="text-zinc-500 text-xs">•</span>
          <span className="text-xs font-semibold text-zinc-300">Command Center</span>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors"
          >
            Painel
          </Link>
          <Link
            href="/trainer/punishment"
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors hidden sm:inline"
          >
            Trap Lab
          </Link>
          <Link
            href="/train"
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors hidden md:inline"
          >
            Treino SM-2
          </Link>
          <Link
            href="/study"
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors hidden lg:inline"
          >
            Estudo
          </Link>
          <Link
            href="/library"
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors hidden lg:inline"
          >
            Biblioteca
          </Link>
        </nav>
      </header>

      {/* ================= HERO & QUICK MATCH ================= */}
      <section className="w-full max-w-5xl px-4 pt-8 pb-6 flex flex-col md:flex-row gap-6 items-stretch justify-center">
        {/* Quick Side Selection Box (preserved for exact test compatibility) */}
        <div className="w-full md:w-[420px] bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-widest text-amber-500 font-mono font-semibold">
              Partida Guiada
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Nova Partida na Arena GM
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Escolha seu lado para iniciar o confronto com análise socrática em tempo real.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => go("white")}
              className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.99] border border-zinc-700 text-white font-medium flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-zinc-100 border border-zinc-300 shadow-sm" />
                <span className="text-sm font-semibold">1. White</span>
              </div>
              <span className="text-xs text-zinc-400 font-mono">Você joga primeiro</span>
            </button>

            <button
              type="button"
              onClick={() => go("black")}
              className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.99] border border-zinc-700 text-white font-medium flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-zinc-900 border border-zinc-700 shadow-sm" />
                <span className="text-sm font-semibold">2. Black</span>
              </div>
              <span className="text-xs text-zinc-400 font-mono">Stockfish joga primeiro</span>
            </button>

            <button
              type="button"
              onClick={() => go("random")}
              className="w-full py-3 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 active:scale-[0.99] border border-amber-600/40 font-medium flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🎲</span>
                <span className="text-sm font-semibold">3. Random</span>
              </div>
              <span className="text-xs text-amber-400/80 font-mono">Cor aleatória</span>
            </button>
          </div>
        </div>

        {/* Student Quick Status & Snapshot */}
        <div className="flex-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-widest text-amber-500 font-mono font-semibold">
              Perfil do Jogador
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-white">
                {profile.rating} <span className="text-xs text-zinc-400 font-sans font-normal">Rating ELO</span>
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {profile.games} {profile.games === 1 ? "partida jogada" : "partidas jogadas"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-mono text-zinc-400">Revisão SM-2</span>
              <span className="text-sm font-bold font-mono text-amber-400">
                {due.due > 0 ? `${due.due} pendente${due.due > 1 ? "s" : ""}` : "Em dia"}
              </span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-mono text-zinc-400">Erros Táticos</span>
              <span className="text-sm font-bold font-mono text-rose-400">
                {profile.errorTags.tactics} registrados
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Link
              href="/dashboard"
              className="flex-1 text-center py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold transition-colors"
            >
              Abrir Painel Completo →
            </Link>
            <Link
              href="/trainer/punishment"
              className="flex-1 text-center py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs font-semibold border border-zinc-700 transition-colors"
            >
              Trap Lab (Punições)
            </Link>
          </div>
        </div>
      </section>

      {/* ================= COMMAND CENTER MODULES ================= */}
      <section className="w-full max-w-5xl px-4 mt-4">
        <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
          <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-300">
            Módulos de Treinamento
          </h2>
          <span className="text-xs text-zinc-500 font-mono">5 módulos integrados</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className="bg-zinc-900/70 border border-zinc-800/80 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 group hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5"
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{m.icon}</span>
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${m.badgeColor}`}>
                    {m.badge}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                    {m.description}
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-semibold text-amber-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                {m.actionLabel} <span>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
