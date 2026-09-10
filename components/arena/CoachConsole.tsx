"use client";

import type { TurnResponse } from "@/lib/coach/schemas";
import type { Label } from "@/lib/chess/measure";
import type { ChatMessage } from "@/lib/chat/store";

interface CoachConsoleProps {
  tab: "critique" | "intent" | "position" | "chat";
  onTabChange: (t: "critique" | "intent" | "position" | "chat") => void;
  coach: TurnResponse | null;
  label: Label | null;
  movesCount: number;
  notice?: string;
  onHint: () => void;
  isHintLoading?: boolean;
  onTriggerPostgame: () => void;
  isPostgameLoading?: boolean;
  onNewGame: () => void;
  tbCategory?: string | null;
  chatMessages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onChatSend: () => void;
  isChatSending?: boolean;
}

const BADGE_CONFIG: Record<
  Label,
  { label: string; bg: string; border: string; text: string }
> = {
  brilliant: {
    label: "🌟 Lance Brilhante!",
    bg: "bg-cyan-500/20",
    border: "border-cyan-500/40",
    text: "text-cyan-300",
  },
  solid: {
    label: "✨ Bom Lance",
    bg: "bg-blue-500/20",
    border: "border-blue-500/40",
    text: "text-blue-300",
  },
  inaccurate: {
    label: "⚠️ Imprecisão",
    bg: "bg-amber-500/20",
    border: "border-amber-500/40",
    text: "text-amber-300",
  },
  mistake: {
    label: "❌ Erro Tático",
    bg: "bg-orange-500/20",
    border: "border-orange-500/40",
    text: "text-orange-300",
  },
  blunder: {
    label: "💥 Capivarada!",
    bg: "bg-rose-500/25",
    border: "border-rose-500/40",
    text: "text-rose-300 font-black tracking-wide animate-pulse",
  },
};

export default function CoachConsole({
  tab,
  onTabChange,
  coach,
  label,
  movesCount,
  notice,
  onHint,
  isHintLoading = false,
  onTriggerPostgame,
  isPostgameLoading = false,
  onNewGame,
  tbCategory,
  chatMessages,
  chatInput,
  onChatInputChange,
  onChatSend,
  isChatSending = false,
}: CoachConsoleProps) {
  const currentBadge = label ? BADGE_CONFIG[label] : null;

  return (
    <div className="flex flex-col h-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800/80 bg-zinc-900/90 text-xs font-mono select-none">
        <button
          type="button"
          onClick={() => onTabChange("critique")}
          className={`flex-1 py-3 px-2 text-center transition-all border-b-2 font-bold ${
            tab === "critique"
              ? "border-amber-500 text-amber-400 bg-amber-500/10"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Crítica
        </button>
        <button
          type="button"
          onClick={() => onTabChange("intent")}
          className={`flex-1 py-3 px-2 text-center transition-all border-b-2 font-bold ${
            tab === "intent"
              ? "border-amber-500 text-amber-400 bg-amber-500/10"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Intenção
        </button>
        <button
          type="button"
          onClick={() => onTabChange("position")}
          className={`flex-1 py-3 px-2 text-center transition-all border-b-2 font-bold ${
            tab === "position"
              ? "border-amber-500 text-amber-400 bg-amber-500/10"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Posição
        </button>
        <button
          type="button"
          onClick={() => onTabChange("chat")}
          className={`flex-1 py-3 px-2 text-center transition-all border-b-2 font-bold ${
            tab === "chat"
              ? "border-amber-500 text-amber-400 bg-amber-500/10"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Conversar
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-sm space-y-4 min-h-[220px]">
        {/* Notice Pill (e.g. Hint) */}
        {notice && (
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-mono shadow-sm flex items-center gap-2 animate-in fade-in">
            <span className="text-base">💡</span>
            <span className="font-semibold">{notice}</span>
          </div>
        )}

        {/* TAB 1: CRITIQUE */}
        {tab === "critique" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Análise do GM
              </span>
              {currentBadge && (
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${currentBadge.bg} ${currentBadge.border} ${currentBadge.text}`}
                >
                  {currentBadge.label}
                </span>
              )}
            </div>

            {coach?.critique ? (
              <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 text-zinc-200 leading-relaxed text-xs sm:text-sm font-sans space-y-2">
                <p>{coach.critique}</p>
                {coach.homework && (
                  <div className="pt-2 border-t border-zinc-700/50 mt-2">
                    <span className="text-[11px] font-mono text-amber-400 font-bold block mb-1">
                      Exercício de Reflexão:
                    </span>
                    <p className="text-xs text-zinc-300 italic">
                      {coach.homework}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-800/60 text-zinc-400 text-xs leading-relaxed">
                {movesCount === 0
                  ? "Faça seu primeiro lance no tabuleiro para o GM Coach analisar sua abertura e intenções táticas."
                  : "Aguardando seu lance no tabuleiro..."}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INTENT */}
        {tab === "intent" && (
          <div className="space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Plano & Estratégia
            </span>
            {coach?.intent ? (
              <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 text-zinc-200 text-xs sm:text-sm leading-relaxed space-y-3">
                <div>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold block mb-1">
                    Diretriz Posicional:
                  </span>
                  <p>{coach.intent}</p>
                </div>
              </div>
            ) : (
              <p className="text-zinc-500 text-xs italic">
                O plano estratégico será traçado à medida que a partida se desenvolver.
              </p>
            )}
          </div>
        )}

        {/* TAB 3: POSITION */}
        {tab === "position" && (
          <div className="space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Diagnóstico Espacial
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">Fase</span>
                <span className="text-zinc-200 font-bold capitalize">
                  {movesCount < 20 ? "Abertura" : movesCount < 60 ? "Meio-jogo" : "Final"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">Lances</span>
                <span className="text-zinc-200 font-bold">{movesCount}</span>
              </div>
            </div>
            {tbCategory && (
              <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/50 text-xs text-cyan-200 font-mono flex items-center justify-between">
                <span>Tablebase (≤7 peças):</span>
                <strong className="text-cyan-400 uppercase">{tbCategory}</strong>
              </div>
            )}
            {coach && coach.tags.length > 0 && (
              <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 text-xs text-zinc-300">
                <span className="text-amber-400 font-mono block text-[10px] uppercase font-bold mb-1">
                  Conceito Chave
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {coach.tags.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-700/60 font-mono text-[11px]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CHAT */}
        {tab === "chat" && (
          <div className="flex flex-col h-full space-y-3">
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {chatMessages.length === 0 ? (
                <p className="text-zinc-500 text-xs italic">
                  Pergunte qualquer coisa ao GM Coach sobre o lance atual.
                </p>
              ) : (
                chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl text-xs ${
                      msg.role === "user"
                        ? "bg-amber-600/20 text-amber-200 border border-amber-600/30 ml-4"
                        : "bg-zinc-800/50 text-zinc-300 border border-zinc-800 mr-4"
                    }`}
                  >
                    <span className="font-bold font-mono text-[10px] block text-zinc-400 mb-0.5">
                      {msg.role === "user" ? "Você" : "GM Coach"}
                    </span>
                    {msg.content}
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onChatSend()}
                placeholder="Ex: Por que d4 é melhor que e4 aqui?"
                className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={onChatSend}
                disabled={isChatSending || !chatInput.trim()}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-mono font-bold transition-colors"
              >
                {isChatSending ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-900/90 flex flex-col gap-2">
        <button
          type="button"
          onClick={onHint}
          disabled={isHintLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-mono font-bold shadow-md shadow-amber-900/20 border border-amber-500/40 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          <span>💡</span>
          <span>{isHintLoading ? "Calculando Dica GM..." : "Pedir Dica Tática (GM)"}</span>
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onTriggerPostgame}
            disabled={isPostgameLoading || movesCount === 0}
            className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-mono font-semibold border border-zinc-700/60 transition-colors disabled:opacity-40"
          >
            {isPostgameLoading ? "Analisando..." : "Analisar Partida"}
          </button>
          <button
            type="button"
            onClick={onNewGame}
            className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-mono font-semibold border border-zinc-700/60 transition-colors"
          >
            Nova Partida
          </button>
        </div>
      </div>
    </div>
  );
}
