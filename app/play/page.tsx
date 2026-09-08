"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chess, type Square } from "chess.js";
import type { Key } from "chessground/types";
import type { DrawShape } from "chessground/draw";
import Board from "@/components/Board";
import { classifyMove, detectPhase, phaseAverages, type Label, type Phase } from "@/lib/chess/measure";
import { createMockEngine, createStockfishEngine, type Engine, type Eval } from "@/lib/engine/engine";
import { applyPostgame, loadProfile, saveProfile, type Profile } from "@/lib/profile/store";
import { appendMessage, loadChat, type ChatMessage } from "@/lib/chat/store";
import { enqueue } from "@/lib/coach/queue";
import type { PostgameResponse, TurnResponse } from "@/lib/coach/schemas";
import { collectEvals, bestMoveEndgameAware } from "@/lib/postgame";
import { addCard } from "@/lib/sm2/scheduler";
import { saveGame, addAnalysis } from "@/lib/library/storage";
import Link from "next/link";

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

type Tab = "critique" | "intent" | "position" | "chat";

function PlayContent() {
  const searchParams = useSearchParams();
  const rawSide = searchParams.get("side");
  const color: "white" | "black" = rawSide === "black" ? "black" : "white";

  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(game.fen());

  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("critique");
  const [label, setLabel] = useState<Label | null>(null);
  const [coach, setCoach] = useState<TurnResponse | null>(null);
  const [arrow, setArrow] = useState<DrawShape[]>([]);
  const [lastEval, setLastEval] = useState<Eval | null>(null);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadChat());
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const [postgame, setPostgame] = useState<PostgameResponse | null>(null);
  const [isPostgameLoading, setIsPostgameLoading] = useState(false);
  const [tbCategory, setTbCategory] = useState<string | null>(null);

  const engineRef = useRef<Engine | null>(null);
  const profileRef = useRef(loadProfile());
  const eloSetRef = useRef(false);

  const triggerPostgame = async () => {
    setIsPostgameLoading(true);
    try {
      const engine = engineRef.current ?? createMockEngine();
      const rows = await collectEvals(game.pgn(), engine);
      const phases = phaseAverages(rows.map((r) => ({ phase: r.phase, score: r.score })));
      const won =
        game.isCheckmate() &&
        ((game.turn() === "b" && color === "white") || (game.turn() === "w" && color === "black"));

      let postgameData: PostgameResponse;
      try {
        const res = await fetch("/api/coach/postgame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pgn: game.pgn(), evals: rows, phaseScores: phases }),
        });
        if (!res.ok) throw new Error("postgame failed");
        postgameData = (await res.json()) as PostgameResponse;
      } catch {
        postgameData = {
          summary: `Fim de jogo. ${won ? "Vitória do aluno!" : "Fim da partida."} Foram jogados ${rows.length} lances.`,
          result: won ? "1-0" : "0-1",
          moments: rows
            .filter((r) => r.label === "mistake" || r.label === "blunder")
            .slice(0, 3)
            .map((r) => ({
              move: Math.ceil(r.ply / 2),
              played: r.san,
              best: r.best,
              why: `Perda de ${r.cpLoss} centipawns em lance de ${r.phase}.`,
            })),
          takeaway: "Consolide o cálculo tático e mantenha as peças coordenadas.",
          homework: "Rever os momentos críticos e treinar no SM-2.",
          profileDelta: {},
        };
      }
      setPostgame(postgameData);

      const blunderRows = rows.filter((r) => r.label === "blunder" || r.label === "mistake");
      for (const b of blunderRows) {
        if (b.best) {
          addCard({
            fen: b.fen,
            bestMove: b.best,
            context: `${b.phase} - ${b.label}: jogado ${b.san}`,
          });
        }
      }
      const tags: (keyof Profile["errorTags"])[] = blunderRows.map(() => "tactics");
      const fens = blunderRows.map((r) => r.fen);
      const updated = applyPostgame(profileRef.current, { won, tags, fens, phases });
      saveProfile(updated);
      profileRef.current = updated;

      const savedId = saveGame(game.pgn());
      addAnalysis(savedId, { depth: 10, rows });
    } finally {
      setIsPostgameLoading(false);
    }
  };

  const makeEngineMove = async (currentFen: string, engineInstance?: Engine) => {
    setIsEngineThinking(true);
    try {
      const eng = engineInstance ?? engineRef.current ?? createMockEngine();
      const egAfter = await bestMoveEndgameAware(currentFen, eng, 12);
      setTbCategory(egAfter.category);

      let replyUci = egAfter.best;
      if (!replyUci) {
        const ev = await eng.analyze(currentFen, 12);
        replyUci = ev.best;
      }

      let moveSuccess = false;
      if (replyUci && replyUci.length >= 4) {
        const replyFrom = replyUci.slice(0, 2);
        const replyTo = replyUci.slice(2, 4);
        const replyProm = replyUci.slice(4, 5) || undefined;
        try {
          const res = game.move({ from: replyFrom, to: replyTo, promotion: replyProm });
          if (res) {
            moveSuccess = true;
            setFen(game.fen());
          }
        } catch {
          moveSuccess = false;
        }
      }

      // Legal fallback if engine UCI was invalid or blocked
      if (!moveSuccess && !game.isGameOver()) {
        const legal = game.moves({ verbose: true });
        if (legal.length > 0) {
          const chosen = legal[0];
          game.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion });
          setFen(game.fen());
        }
      }

      if (game.isGameOver()) {
        await triggerPostgame();
      }
    } catch {
      setNotice("Engine evaluation interrupted.");
    } finally {
      setIsEngineThinking(false);
    }
  };

  useEffect(() => {
    let eng: Engine;
    try {
      eng = createStockfishEngine();
    } catch {
      eng = createMockEngine();
    }
    engineRef.current = eng;

    // If user chose Black, engine (White) must make the first move!
    if (color === "black" && game.history().length === 0) {
      setTimeout(() => {
        makeEngineMove(game.fen(), eng);
      }, 500);
    }

    return () => {
      eng.quit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);


  const ensureElo = async () => {
    if (!eloSetRef.current && engineRef.current) {
      const capElo = profileRef.current.rating + 250;
      await engineRef.current.setElo(capElo);
      eloSetRef.current = true;
    }
  };

  const postTurnCoachWithRetry = async (payload: {
    fen: string;
    pgn: string;
    cpLoss: number;
    bestMove: string;
    phase: Phase;
  }): Promise<TurnResponse> => {
    const doFetch = async () => {
      const res = await fetch("/api/coach/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as TurnResponse;
    };

    try {
      return await doFetch();
    } catch {
      // retry once
      try {
        return await doFetch();
      } catch {
        enqueue(payload);
        return {
          critique: `Coach offline. Move classified as **${label ?? "solid"}**. Best move was **${payload.bestMove}**.`,
          intent: "Keep your pieces coordinated and watch king safety.",
          tags: ["tactics"],
          homework: "Review position with local engine analysis.",
        };
      }
    }
  };

  const onMove = async (from: string, to: string) => {
    if (isEngineThinking) return;

    const pieceBefore = game.get(from as Square);
    const movedValue = pieceBefore ? PIECE_VALUES[pieceBefore.type] : 0;
    const fenBefore = game.fen();
    const ply = game.history().length;
    const phase = detectPhase(ply, game);

    let moveResult = null;
    try {
      moveResult = game.move({ from, to, promotion: "q" });
    } catch {
      setFen(game.fen());
      setNotice(`Illegal move ${from}→${to}: blocked by chess.js legality rules. Choose a legal move.`);
      return;
    }

    setFen(game.fen());
    setNotice("");
    setIsEngineThinking(true);

    try {
      const engine = engineRef.current ?? createMockEngine();
      await ensureElo();

      // Analyze before move and after move to compute cpLoss
      const evalBefore = await engine.analyze(fenBefore, 12);
      const fenAfter = game.fen();
      const evalAfter = await engine.analyze(fenAfter, 12);
      setLastEval(evalAfter);

      const moverIsWhite = pieceBefore?.color === "w";
      const moverCpBefore = moverIsWhite ? evalBefore.cp : -evalBefore.cp;
      const moverCpAfter = moverIsWhite ? evalAfter.cp : -evalAfter.cp;
      const cpLoss = Math.max(0, moverCpBefore - moverCpAfter);

      const capturedValue = moveResult?.captured ? PIECE_VALUES[moveResult.captured] : 0;
      const wasSacrifice = movedValue > capturedValue && cpLoss < 30;
      const evalKept = moverCpAfter >= moverCpBefore - 20;

      const moveLabel = classifyMove(cpLoss, wasSacrifice, evalKept);
      setLabel(moveLabel);

      const egBefore = await bestMoveEndgameAware(fenBefore, engine, 12);
      const effectiveBestBefore = egBefore.best || evalBefore.best;

      // Best move arrow
      if (effectiveBestBefore && effectiveBestBefore.length >= 4) {
        const orig = effectiveBestBefore.slice(0, 2) as Key;
        const dest = effectiveBestBefore.slice(2, 4) as Key;
        setArrow([{ orig, dest, brush: "green" }]);
      }

      // Coach feedback
      const coachData = await postTurnCoachWithRetry({
        fen: fenAfter,
        pgn: game.pgn(),
        cpLoss,
        bestMove: effectiveBestBefore,
        phase,
      });
      setCoach(coachData);

      // Check if game over after player's move
      if (game.isGameOver()) {
        await triggerPostgame();
        return;
      }

      // Engine reply if game not ended (TB-first in ≤7 pieces)
      await makeEngineMove(fenAfter, engine);
    } catch {
      setNotice("Engine evaluation interrupted.");
    } finally {
      setIsEngineThinking(false);
    }
  };


  const handleUndo = async () => {
    if (isEngineThinking) return;
    if (game.history().length === 0) return;

    // If it is player's turn, undo opponent's move AND player's previous move (1 full move pair)
    // If it was opponent's turn (or player just moved), undo at least 1 move to get back to player's turn
    const isPlayerTurn = (game.turn() === "w" && color === "white") || (game.turn() === "b" && color === "black");
    if (isPlayerTurn) {
      game.undo(); // Undo opponent's move
      if (game.history().length > 0) {
        game.undo(); // Undo player's move
      }
    } else {
      game.undo(); // Undo player's last move
    }

    setFen(game.fen());
    setArrow([]);
    setLabel(null);
    setNotice("Jogada desfeita.");

    // Update evaluation for the restored position
    try {
      const engine = engineRef.current ?? createMockEngine();
      const ev = await engine.analyze(game.fen(), 10);
      setLastEval(ev);
    } catch {
      // ignore
    }
  };

  const sendChatMessage = async (text: string) => {
    if (!text.trim() || isChatSending) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const updated = appendMessage(userMsg);
    setChatMessages(updated);
    setChatInput("");
    setIsChatSending(true);

    const payload = {
      history: updated.slice(-12),
      fen: game.fen(),
      pgn: game.pgn(),
      phase: detectPhase(game.history().length, game),
      profile: profileRef.current,
      lastEval,
    };

    const doFetch = async () => {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { reply: string };
    };

    try {
      let data: { reply: string };
      try {
        data = await doFetch();
      } catch {
        data = await doFetch(); // retry 1x
      }
      const assistantMsg: ChatMessage = { role: "assistant", content: data.reply };
      setChatMessages(appendMessage(assistantMsg));
    } catch {
      enqueue({ type: "chat", ...payload });
      const fallbackMsg: ChatMessage = {
        role: "assistant",
        content: "Coach offline, mensagem na fila. Analise a posição atual e busque peças desprotegidas.",
      };
      setChatMessages(appendMessage(fallbackMsg));
    } finally {
      setIsChatSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 p-4 md:p-8 flex flex-col lg:flex-row gap-8 justify-center items-start">
      {/* Left column: Board & Status */}
      <div className="flex flex-col gap-4 items-center w-full lg:w-auto">
        <div className="flex items-center justify-between w-full max-w-[560px]">
          <span className="text-xs uppercase font-mono tracking-widest text-amber-500 font-semibold">
            Você: {color === "white" ? "Brancas" : "Pretas"}
          </span>
          {label && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                label === "brilliant"
                  ? "bg-cyan-900/60 text-cyan-300 border border-cyan-700"
                  : label === "solid"
                  ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                  : label === "inaccurate"
                  ? "bg-amber-900/60 text-amber-300 border border-amber-700"
                  : label === "mistake"
                  ? "bg-orange-900/60 text-orange-300 border border-orange-700"
                  : "bg-rose-900/60 text-rose-300 border border-rose-700"
              }`}
            >
              {label}
            </span>
          )}
        </div>

        <Board fen={fen} orientation={color} onMove={onMove} shape={arrow} />

        {/* Board Action Bar: Undo, Status & Restart */}
        <div className="flex items-center justify-between w-full max-w-[560px] gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={isEngineThinking || game.history().length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 text-zinc-200 text-xs font-mono font-semibold rounded-xl transition-all shadow-sm"
            title="Desfazer o último par de lances e tentar outra jogada"
          >
            <span>↩</span>
            <span>Voltar Jogada</span>
          </button>

          <span className="text-[11px] font-mono text-zinc-500">
            Lances: {Math.floor(game.history().length / 2)} {game.history().length % 2 !== 0 ? "½" : ""}
          </span>

          <Link
            href="/"
            className="text-xs font-mono text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-xl hover:bg-zinc-800/60 transition-colors"
          >
            Nova Partida
          </Link>
        </div>

        {isEngineThinking && (
          <div className="text-xs text-amber-400 font-mono animate-pulse">Stockfish analisando...</div>
        )}

        {notice && (
          <p
            role="alert"
            className="text-sm text-amber-300 bg-amber-950/50 border border-amber-800/60 px-4 py-2 rounded-xl max-w-[560px]"
          >
            {notice}
          </p>
        )}
      </div>

      {/* Right column: 4 Coach Tabs */}
      <div className="w-full lg:w-[480px] bg-zinc-900/90 border border-zinc-800 rounded-2xl flex flex-col h-[580px] shadow-xl overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/50">
          {(["critique", "intent", "position", "chat"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                tab === t
                  ? "border-amber-500 text-amber-400 bg-amber-500/10"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t === "chat" ? "Conversar" : t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-5 overflow-y-auto">
          {tab === "critique" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Crítica do GM</h2>
              <div className="text-sm text-zinc-200 leading-relaxed bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/60 whitespace-pre-wrap">
                {coach?.critique ?? "Faça seu primeiro lance para o GM analisar a posição."}
              </div>
              {coach?.homework && (
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-amber-950/30 border border-amber-900/40">
                  <span className="text-xs font-bold text-amber-400 uppercase">Exercício</span>
                  <p className="text-xs text-amber-200/90">{coach.homework}</p>
                </div>
              )}
            </div>
          )}

          {tab === "intent" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Intenção & Plano</h2>
              <div className="text-sm text-zinc-200 leading-relaxed bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/60 whitespace-pre-wrap">
                {coach?.intent ?? "Aguardando seu lance para desvendar os planos táticos e posicionais."}
              </div>
              {coach?.tags && coach.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {coach.tags.map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded-md font-mono">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "position" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Métricas da Posição</h2>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-zinc-400 font-mono uppercase">Avaliação (cp)</span>
                <div className="text-lg font-bold font-mono text-amber-400 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                  {lastEval?.mate != null ? `Mate em ${lastEval.mate}` : `${((lastEval?.cp ?? 0) / 100).toFixed(2)}`}
                </div>
              </div>
              {tbCategory && (
                <div className="flex flex-col gap-1 p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                    Lichess Tablebase (≤7 peças)
                  </span>
                  <span className="text-xs font-mono text-cyan-200">
                    Resultado Teórico: <strong>{tbCategory.toUpperCase()}</strong>
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-zinc-400 font-mono uppercase">FEN</span>
                <code className="text-xs font-mono text-amber-200/90 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 break-all">
                  {fen}
                </code>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-zinc-400 font-mono uppercase">PGN</span>
                <pre className="text-xs font-mono text-zinc-300 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {game.pgn() || "(game start)"}
                </pre>
              </div>
            </div>
          )}

          {tab === "chat" && (
            <div className="flex flex-col h-full gap-3">
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center my-auto">
                    Converse com seu treinador. Pergunte o motivo de um lance, peça um plano ou um desafio.
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl text-xs leading-relaxed max-w-[85%] ${
                      msg.role === "user"
                        ? "ml-auto bg-amber-600/30 text-amber-100 border border-amber-600/40"
                        : "mr-auto bg-zinc-950 text-zinc-200 border border-zinc-800"
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>

              {/* Shortcut chips */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {["Por quê?", "Plano?", "Me desafia"].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendChatMessage(chip)}
                    className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 whitespace-nowrap transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChatMessage(chatInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Pergunte ao GM..."
                  disabled={isChatSending}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={isChatSending || !chatInput.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
                >
                  {isChatSending ? "..." : "Enviar"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Postgame Analysis Modal */}
      {(postgame || isPostgameLoading) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 flex flex-col gap-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {isPostgameLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-mono text-amber-400">GM calculando relatório pós-jogo...</span>
              </div>
            ) : (
              postgame && (
                <>
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-amber-500 font-semibold">
                        Relatório Pós-Jogo
                      </span>
                      <h2 className="text-xl font-bold text-white mt-0.5">Resultado: {postgame.result}</h2>
                    </div>
                    <span className="text-xs px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full font-mono font-bold">
                      Partida Finalizada
                    </span>
                  </div>

                  <div className="text-sm text-zinc-300 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800">
                    {postgame.summary}
                  </div>

                  {postgame.moments.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Momentos Críticos
                      </span>
                      <div className="flex flex-col gap-2">
                        {postgame.moments.map((m, idx) => (
                          <div
                            key={idx}
                            className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex flex-col gap-1 text-xs"
                          >
                            <div className="flex justify-between font-mono">
                              <span className="text-zinc-300 font-bold">Lance {m.move}</span>
                              <span className="text-red-400">Jogado: {m.played}</span>
                              <span className="text-emerald-400">Melhor: {m.best}</span>
                            </div>
                            <p className="text-zinc-400">{m.why}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 bg-amber-950/20 border border-amber-900/30 p-4 rounded-xl">
                    <span className="text-xs font-bold text-amber-400 uppercase">Lição Principal</span>
                    <p className="text-xs text-amber-200">{postgame.takeaway}</p>
                    <p className="text-xs text-amber-400 font-mono mt-1">Exercício: {postgame.homework}</p>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Link
                      href="/train"
                      className="flex-1 min-w-[140px] py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-center text-xs font-semibold rounded-xl transition-all"
                    >
                      Treinar Erros (SM-2)
                    </Link>
                    <Link
                      href="/dashboard"
                      className="flex-1 min-w-[140px] py-3 bg-amber-600 hover:bg-amber-500 text-white text-center text-xs font-semibold rounded-xl transition-all"
                    >
                      Ver Painel & Métricas
                    </Link>
                    <button
                      onClick={() => setPostgame(null)}
                      className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#161512] flex items-center justify-center text-zinc-400">Loading match...</div>}>
      <PlayContent />
    </Suspense>
  );
}
