"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Dices, Flame, Play } from "lucide-react";
import { DEFAULT_PROFILE, getProfileSnapshot, subscribeProfile } from "@/lib/profile/store";
import { EMPTY_CARDS, getCardsSnapshot, subscribeCards, summarizeDue } from "@/lib/sm2/scheduler";
import repertoireData from "@/data/repertoire.json";

interface RepertoireOpening {
  name: string;
  eco: string;
  variations: { name: string; line: string[] }[];
}

interface TrailNode {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  done: boolean;
  current: boolean;
  locked: boolean;
}

function buildTrail(openingsDone: Record<string, number>): TrailNode[] {
  const openings = [...repertoireData.white, ...repertoireData.black] as RepertoireOpening[];
  let currentAssigned = false;
  return openings.map((o, i) => {
    const done = (openingsDone[o.name] ?? 0) > 0;
    const current = !done && !currentAssigned;
    if (current) currentAssigned = true;
    const locked = !done && !current;
    return {
      key: o.name,
      title: `${i + 1}. ${o.name}`,
      subtitle: `${o.eco} · ${o.variations.length} linhas`,
      href: `/study?opening=${encodeURIComponent(o.name)}`,
      done,
      current,
      locked,
    };
  });
}

export default function Learn() {
  const router = useRouter();
  const profile = useSyncExternalStore(subscribeProfile, getProfileSnapshot, () => DEFAULT_PROFILE);
  const cards = useSyncExternalStore(subscribeCards, getCardsSnapshot, () => EMPTY_CARDS);
  const due = summarizeDue(cards);
  const trail = buildTrail(profile.openings);
  const current = trail.find((t) => t.current) ?? trail[0];
  const doneCount = trail.filter((t) => t.done).length;

  const go = (side: string) => {
    const chosen = side === "random" ? (Math.random() < 0.5 ? "white" : "black") : side;
    router.push(`/play?side=${chosen}`);
  };

  return (
    <main className="min-h-screen bg-noir-bg text-noir-ink flex flex-col items-center select-none pb-12">
      <div className="w-full max-w-lg px-4 pt-8 flex flex-col gap-4">
        <p className="text-[13px] font-semibold text-noir-muted">Aprender aberturas</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Sua trilha de aberturas
        </h1>
        <p className="text-[15px] text-noir-muted leading-relaxed">
          {doneCount} de {trail.length} concluídas. Uma lição curta por vez.
        </p>

        <div className="bg-noir-surface rounded-[20px] border border-noir-line p-5 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 text-bronze">
            <Flame size={16} />
            <span className="text-[13px] font-semibold">Continuar aprendendo</span>
          </div>
          <p className="text-[17px] font-semibold">{current.title}</p>
          <p className="text-[13px] text-noir-muted">{current.subtitle}</p>
          <Link
            href={current.href}
            className="mt-1 text-center py-3.5 px-4 rounded-[14px] bg-bronze text-white text-[17px] font-semibold active:scale-[0.99] transition-transform"
          >
            Continuar
          </Link>
          {due.due > 0 && (
            <Link href="/train" className="text-center text-[15px] font-medium text-bronze py-1">
              Revisar {due.due} posição{due.due > 1 ? "ões" : ""} pendente{due.due > 1 ? "s" : ""}
            </Link>
          )}
        </div>

        <ol className="flex flex-col gap-3 mt-2" aria-label="Trilha de aberturas">
          {trail.map((t) => (
            <li key={t.key}>
              <Link
                href={t.locked ? "#" : t.href}
                aria-disabled={t.locked}
                onClick={(e) => {
                  if (t.locked) e.preventDefault();
                }}
                className={`flex items-center gap-3 rounded-[20px] border p-4 transition-colors ${
                  t.current
                    ? "bg-noir-surface border-bronze/40 shadow-sm"
                    : t.done
                      ? "bg-noir-surface border-noir-line"
                      : "bg-noir-surface/60 border-noir-line opacity-60"
                }`}
              >
                <span
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[17px] font-bold ${
                    t.done
                      ? "bg-[#34c759]/15 text-[#34c759]"
                      : t.current
                        ? "bg-bronze text-white"
                        : "bg-noir-raised text-noir-muted"
                  }`}
                  aria-hidden
                >
                  {t.done ? "✓" : t.locked ? "🔒" : <BookOpen size={18} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[17px] font-semibold truncate">{t.title}</span>
                  <span className="block text-[13px] text-noir-muted">{t.subtitle}</span>
                </span>
                <ChevronRight size={18} className="text-noir-muted shrink-0" />
              </Link>
            </li>
          ))}
        </ol>

        <div className="bg-noir-surface rounded-[20px] border border-noir-line p-5 flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2">
            <Play size={16} className="text-noir-muted" />
            <span className="text-[15px] font-semibold">Praticar em partida</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go("white")}
              className="flex-1 py-3 px-4 rounded-[14px] bg-noir-raised text-noir-ink text-[15px] font-semibold"
            >
              White
            </button>
            <button
              type="button"
              onClick={() => go("black")}
              className="flex-1 py-3 px-4 rounded-[14px] bg-noir-raised text-noir-ink text-[15px] font-semibold"
            >
              Black
            </button>
            <button
              type="button"
              onClick={() => go("random")}
              aria-label="Cor aleatória"
              className="py-3 px-4 rounded-[14px] bg-noir-raised text-noir-ink"
            >
              <Dices size={16} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
