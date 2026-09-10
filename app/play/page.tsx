"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Chess, type Square } from "chess.js";
import type { Key } from "chessground/types";
import type { DrawShape } from "chessground/draw";
import Board from "@/components/Board";
import EvalBar from "@/components/arena/EvalBar";
import PlayerCard from "@/components/arena/PlayerCard";
import MoveHistory, { type HistoryMove } from "@/components/arena/MoveHistory";
import CoachConsole from "@/components/arena/CoachConsole";
import { calculateMaterial } from "@/lib/chess/material";
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playGameEndSound,
  getAudioMutedSnapshot,
  setAudioMuted,
  subscribeAudioMuted,
} from "@/lib/sound/audio";
import { classifyMove, detectPhase, phaseAverages, type Label, type Phase } from "@/lib/chess/measure";
import { createMockEngine, createStockfishEngine, type Engine, type Eval } from "@/lib/engine/engine";
import {
  applyPostgame,
  DEFAULT_PROFILE,
  getProfileSnapshot,
  subscribeProfile,
  saveProfile,
  type Profile,
} from "@/lib/profile/store";
import { appendMessage, getChatSnapshot, subscribeChat, type ChatMessage } from "@/lib/chat/store";
import { enqueue } from "@/lib/coach/queue";
import type { PostgameResponse, TurnResponse } from "@/lib/coach/schemas";
import { generateMoveAnalysis, type MoveAnalysisInput } from "@/lib/coach/analysis";
import { collectEvals, bestMoveEndgameAware } from "@/lib/postgame";
import { addCard } from "@/lib/sm2/scheduler";
import { saveGame, addAnalysis } from "@/lib/library/storage";
import Link from "next/link";

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const EMPTY_CHAT: ChatMessage[] = [];

type Tab = "critique" | "intent" | "position" | "chat";

function PlayContent() {
  const searchParams = useSearchParams();
  const rawSide = searchParams.get("side");
  const color: "white" | "black" = rawSide === "black" ? "black" : "white";

  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(game.fen());

  // Arena & Audio States
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(color);
  const isMuted = useSyncExternalStore(subscribeAudioMuted, getAudioMutedSnapshot, () => false);
  const [movesHistory, setMovesHistory] = useState<HistoryMove[]>([]);
  const [viewingPly, setViewingPly] = useState<number>(0);

  // Coach & Game States
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("critique");
  const [label, setLabel] = useState<Label | null>(null);
  const [coach, setCoach] = useState<TurnResponse | null>(null);
  const [arrow, setArrow] = useState<DrawShape[]>([]);
  const [lastEval, setLastEval] = useState<Eval | null>(null);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const chatMessages = useSyncExternalStore(subscribeChat, getChatSnapshot, () => EMPTY_CHAT);
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const [postgame, setPostgame] = useState<PostgameResponse | null>(null);
  const [isPostgameLoading, setIsPostgameLoading] = useState(false);
  const [tbCategory, setTbCategory] = useState<string | null>(null);
  const [aiDifficulty, setAiDifficulty] = useState<"grandmaster" | "master" | "adaptive">("grandmaster");
  const profile = useSyncExternalStore(subscribeProfile, getProfileSnapshot, () => DEFAULT_PROFILE);
  const playerRating = profile.rating;

  const engineRef = useRef<Engine | null>(null);
  const profileRef = useRef<Profile>(DEFAULT_PROFILE);
  const eloSetRef = useRef(false);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Compute viewing position for non-destructive history review
  const viewingFen = useMemo(() => {
    if (viewingPly >= movesHistory.length) {
      return fen;
    }
    const replay = new Chess();
    for (let i = 0; i < viewingPly; i++) {
      const m = movesHistory[i];
      if (!m) break;
      try {
        replay.move({ from: m.from, to: m.to, promotion: "q" });
      } catch {
        break;
      }
    }
    return replay.fen();
  }, [viewingPly, movesHistory, fen]);

  // Compute captured pieces and material differences
  const material = useMemo(() => {
    return calculateMaterial(viewingFen);
  }, [viewingFen]);

  const handleToggleAudio = () => {
    setAudioMuted(!isMuted);
  };

  const handleFlipBoard = () => {
    setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
  };

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
            fen: b.fenBefore || b.fen,
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
      addAnalysis(savedId, { depth: 12, rows });
    } finally {
      setIsPostgameLoading(false);
    }
  };

  const makeEngineMove = async (currentFen: string, engineInstance?: Engine) => {
    const engineColor = color === "white" ? "b" : "w";
    if (game.turn() !== engineColor || game.isGameOver()) {
      return;
    }

    setIsEngineThinking(true);
    try {
      const eng = engineInstance ?? engineRef.current ?? createMockEngine();
      const egAfter = await bestMoveEndgameAware(currentFen, eng, 12);
      setTbCategory(egAfter.category);

      let replyUci = egAfter.best;
      if (!replyUci) {
        const difficultyOptions =
          aiDifficulty === "grandmaster"
            ? { limitStrength: false }
            : aiDifficulty === "master"
            ? { limitStrength: true, elo: 2200 }
            : { limitStrength: true, elo: Math.max(1320, profileRef.current.rating + 250) };
        const ev = await eng.analyze(currentFen, 12, difficultyOptions);
        replyUci = ev.best;
      }

      let moveSuccess = false;
      let engineMoveResult = null;
      if (replyUci && replyUci.length >= 4) {
        const replyFrom = replyUci.slice(0, 2);
        const replyTo = replyUci.slice(2, 4);
        const replyProm = replyUci.slice(4, 5) || undefined;
        try {
          if (game.turn() === engineColor) {
            engineMoveResult = game.move({ from: replyFrom, to: replyTo, promotion: replyProm });
            if (engineMoveResult) {
              moveSuccess = true;
            }
          }
        } catch {
          moveSuccess = false;
        }
      }

      // Legal fallback if engine UCI was invalid or blocked
      if (!moveSuccess && !game.isGameOver() && game.turn() === engineColor) {
        const legal = game.moves({ verbose: true });
        if (legal.length > 0) {
          const chosen = legal[0];
          engineMoveResult = game.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion });
        }
      }

      if (engineMoveResult) {
        const updatedFen = game.fen();
        setFen(updatedFen);

        // Sound trigger
        if (game.isGameOver()) {
          playGameEndSound();
        } else if (game.inCheck()) {
          playCheckSound();
        } else if (engineMoveResult.captured) {
          playCaptureSound();
        } else {
          playMoveSound();
        }

        // Record history
        setMovesHistory((prev) => {
          const next = [
            ...prev,
            {
              ply: prev.length + 1,
              san: engineMoveResult.san,
              from: engineMoveResult.from,
              to: engineMoveResult.to,
            },
          ];
          setViewingPly(next.length);
          return next;
        });
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

    let timer: NodeJS.Timeout | null = null;
    // If user chose Black, engine (White) must make the first move!
    if (color === "black" && game.history().length === 0 && game.turn() === "w") {
      timer = setTimeout(() => {
        if (game.history().length === 0 && game.turn() === "w") {
          makeEngineMove(game.fen(), eng);
        }
      }, 300);
    }

    return () => {
      if (timer) clearTimeout(timer);
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

  const postTurnCoachWithRetry = async (
    payload: MoveAnalysisInput & {
      fen: string;
      fenBefore?: string;
      fenAfter?: string;
      pgn: string;
      cpLoss: number;
      bestMove: string;
      phase: Phase;
      san?: string;
      from?: string;
      to?: string;
      piece?: string;
      color?: string;
      captured?: string;
      flags?: string;
      moveLabel?: Label;
      isCheck?: boolean;
      isCheckmate?: boolean;
    }
  ): Promise<TurnResponse> => {
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
      try {
        return await doFetch();
      } catch {
        enqueue(payload);
        return generateMoveAnalysis(payload);
      }
    }
  };

  const onMove = async (from: string, to: string) => {
    const playerColor = color === "white" ? "w" : "b";
    if (isEngineThinking || game.turn() !== playerColor) {
      setFen(game.fen());
      return;
    }

    const pieceBefore = game.get(from as Square);
    if (!pieceBefore || pieceBefore.color !== playerColor) {
      setFen(game.fen());
      return;
    }
    const movedValue = pieceBefore ? PIECE_VALUES[pieceBefore.type] : 0;
    const fenBefore = game.fen();
    const ply = game.history().length;
    const phase = detectPhase(ply, game);

    let moveResult = null;
    try {
      moveResult = game.move({ from, to, promotion: "q" });
    } catch {
      setFen(game.fen());
      setNotice(`Lance ilegal ${from}→${to}.`);
      return;
    }

    const fenAfterPlayer = game.fen();
    setFen(fenAfterPlayer);
    setArrow([]);
    setNotice("");
    setIsEngineThinking(true);

    // Play player sound
    if (game.isGameOver()) {
      playGameEndSound();
    } else if (game.inCheck()) {
      playCheckSound();
    } else if (moveResult.captured) {
      playCaptureSound();
    } else {
      playMoveSound();
    }

    // Record player move in history
    setMovesHistory((prev) => {
      const next = [
        ...prev,
        {
          ply: prev.length + 1,
          san: moveResult.san,
          from: moveResult.from,
          to: moveResult.to,
        },
      ];
      setViewingPly(next.length);
      return next;
    });

    try {
      const engine = engineRef.current ?? createMockEngine();
      await ensureElo();

      if (game.isGameOver()) {
        await triggerPostgame();
        setIsEngineThinking(false);
        return;
      }

      // 1. Engine responds promptly
      await makeEngineMove(fenAfterPlayer, engine);

      // 2. Background Coach evaluation
      (async () => {
        try {
          const evalBefore = await engine.analyze(fenBefore, 12, { limitStrength: false });
          const evalAfter = await engine.analyze(fenAfterPlayer, 12, { limitStrength: false });
          setLastEval(evalAfter);

          const moverCpBefore = evalBefore.cp;
          const moverCpAfter = -evalAfter.cp;
          const cpLoss = Math.max(0, moverCpBefore - moverCpAfter);

          const capturedValue = moveResult?.captured ? PIECE_VALUES[moveResult.captured] : 0;
          const evalKept = moverCpAfter >= moverCpBefore - 25;
          const oppColor = playerColor === "w" ? "b" : "w";
          const tempGame = new Chess(fenAfterPlayer);
          const isAttackedByOpponent = tempGame.isAttacked(to as Square, oppColor);
          const wasSacrifice = isAttackedByOpponent && movedValue > capturedValue && cpLoss < 30 && evalKept;

          const moveLabel = classifyMove(cpLoss, wasSacrifice, evalKept);
          setLabel(moveLabel);

          const egBefore = await bestMoveEndgameAware(fenBefore, engine, 12);
          const effectiveBestBefore = egBefore.best || evalBefore.best;

          const coachData = await postTurnCoachWithRetry({
            fen: fenAfterPlayer,
            fenBefore,
            fenAfter: fenAfterPlayer,
            pgn: game.pgn(),
            cpLoss,
            bestMove: effectiveBestBefore,
            phase,
            san: moveResult?.san,
            from: moveResult?.from,
            to: moveResult?.to,
            piece: moveResult?.piece,
            color: playerColor,
            captured: moveResult?.captured,
            flags: moveResult?.flags,
            moveLabel,
            isCheck: game.inCheck(),
            isCheckmate: game.isGameOver() && game.inCheck(),
          });
          setCoach(coachData);
        } catch {
          // Graceful background catch
        }
      })().catch(() => {});
    } catch {
      setNotice("Engine evaluation interrupted.");
    } finally {
      setIsEngineThinking(false);
    }
  };

  const handleAskHint = async () => {
    if (isEngineThinking || isHintLoading) return;
    setIsHintLoading(true);
    try {
      const engine = engineRef.current ?? createMockEngine();
      // Always compute hint with full Grandmaster strength
      const ev = await engine.analyze(game.fen(), 12, { limitStrength: false });
      setLastEval(ev);

      if (ev.best && ev.best.length >= 4) {
        const orig = ev.best.slice(0, 2) as Key;
        const dest = ev.best.slice(2, 4) as Key;
        setArrow([{ orig, dest, brush: "green" }]);
        setNotice(`Dica GM: ${orig.toUpperCase()} → ${dest.toUpperCase()}`);
      } else {
        setNotice("Dica indisponível para esta posição.");
      }
    } catch {
      setNotice("Falha ao calcular dica.");
    } finally {
      setIsHintLoading(false);
    }
  };

  const sendChatMessage = async (text: string) => {
    if (!text.trim() || isChatSending) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const updated = appendMessage(userMsg);
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
      appendMessage(assistantMsg);
    } catch {
      enqueue({ type: "chat", ...payload });
      const fallbackMsg: ChatMessage = {
        role: "assistant",
        content: "Coach offline, mensagem na fila. Analise a posição atual e busque peças desprotegidas.",
      };
      appendMessage(fallbackMsg);
    } finally {
      setIsChatSending(false);
    }
  };

  const handleResetGame = () => {
    game.reset();
    setFen(game.fen());
    setMovesHistory([]);
    setViewingPly(0);
    setCoach(null);
    setLabel(null);
    setArrow([]);
    setNotice("");
    setPostgame(null);
    if (color === "black") {
      const eng = engineRef.current ?? createMockEngine();
      setTimeout(() => {
        makeEngineMove(game.fen(), eng);
      }, 300);
    }
  };

  const opponentColor = color === "white" ? "black" : "white";
  const isPlayerTurn =
    (game.turn() === "w" && color === "white") || (game.turn() === "b" && color === "black");
  const isLiveMode = viewingPly === movesHistory.length;

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 flex flex-col items-center select-none pb-8">
      {/* ================= TOPBAR HEADER ================= */}
      <header className="w-full max-w-7xl px-4 py-3 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-mono text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <span>←</span>
            <span className="hidden sm:inline">Painel</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-500 font-bold tracking-wider text-xs uppercase font-mono">
              En Passant
            </span>
            <span className="text-zinc-500 text-xs">•</span>
            <span className="text-xs font-semibold text-zinc-300">Arena GM</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Difficulty Selector */}
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">Nível:</span>
            <select
              value={aiDifficulty}
              onChange={(e) => setAiDifficulty(e.target.value as "grandmaster" | "master" | "adaptive")}
              className="bg-transparent text-xs font-mono text-amber-400 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="grandmaster" className="bg-zinc-900 text-white">Grande Mestre (SF 18)</option>
              <option value="master" className="bg-zinc-900 text-white">Mestre (~2200)</option>
              <option value="adaptive" className="bg-zinc-900 text-white">Adaptativo ({playerRating})</option>
            </select>
          </div>

          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={handleToggleAudio}
            title={isMuted ? "Ativar som" : "Desativar som"}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400 transition-colors text-sm"
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      {/* ================= MAIN ARENA GRID ================= */}
      <div className="w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* LEFT COLUMN: BOARD ARENA */}
        <div className="w-full lg:w-[560px] lg:shrink-0 flex flex-col items-center gap-3">
          {/* Opponent Card (Top) */}
          <div className="w-full max-w-[560px]">
            <PlayerCard
              name={
                aiDifficulty === "grandmaster"
                  ? "GM Coach (Stockfish 18)"
                  : aiDifficulty === "master"
                  ? "Mestre Stockfish"
                  : "Coach Adaptativo"
              }
              badge={aiDifficulty === "grandmaster" ? "GM" : "BOT"}
              rating={aiDifficulty === "grandmaster" ? 2800 : aiDifficulty === "master" ? 2200 : playerRating + 250}
              color={opponentColor}
              isTurn={!isPlayerTurn && !game.isGameOver()}
              capturedPieces={opponentColor === "white" ? material.whiteCaptured : material.blackCaptured}
              materialAdvantage={opponentColor === "white" ? material.whiteAdvantage : material.blackAdvantage}
              isThinking={isEngineThinking}
              isEngine
            />
          </div>

          {/* Board Row with Vertical EvalBar */}
          <div className="flex items-center gap-2.5 sm:gap-3 w-full max-w-[560px] justify-center">
            {/* Dynamic Vertical EvalBar */}
            <div className="h-[360px] sm:h-[480px] md:h-[540px]">
              <EvalBar evaluation={lastEval} orientation={boardOrientation} />
            </div>

            {/* Chessground Board */}
            <div className="relative flex-1 min-w-0 max-w-[500px] sm:max-w-[520px]">
              <Board
                fen={viewingFen}
                orientation={boardOrientation}
                onMove={isLiveMode ? onMove : undefined}
                shape={arrow}
                isThinking={isEngineThinking}
              />
            </div>
          </div>

          {/* Player Card (Bottom) */}
          <div className="w-full max-w-[560px]">
            <PlayerCard
              name="Você"
              badge="ALUNO"
              rating={playerRating}
              color={color}
              isTurn={isPlayerTurn && !game.isGameOver()}
              capturedPieces={color === "white" ? material.whiteCaptured : material.blackCaptured}
              materialAdvantage={color === "white" ? material.whiteAdvantage : material.blackAdvantage}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE CONSOLE (MoveHistory + CoachConsole) */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4">
          {/* Upper Box: Move Notation & Transport */}
          <div className="h-[260px] sm:h-[280px]">
            <MoveHistory
              moves={movesHistory}
              currentViewingPly={viewingPly}
              onSelectPly={setViewingPly}
              onFlipBoard={handleFlipBoard}
            />
          </div>

          {/* Lower Box: Rich Coach Console */}
          <div className="min-h-[360px]">
            <CoachConsole
              tab={tab}
              onTabChange={setTab}
              coach={coach}
              label={label}
              movesCount={movesHistory.length}
              notice={notice}
              onHint={handleAskHint}
              isHintLoading={isHintLoading}
              onTriggerPostgame={triggerPostgame}
              isPostgameLoading={isPostgameLoading}
              onNewGame={handleResetGame}
              tbCategory={tbCategory}
              chatMessages={chatMessages}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onChatSend={() => sendChatMessage(chatInput)}
              isChatSending={isChatSending}
            />
          </div>
        </div>
      </div>

      {/* ================= POSTGAME MODAL ================= */}
      {(postgame || isPostgameLoading) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#161512] flex items-center justify-center text-zinc-400">
          Carregando arena de xadrez...
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}
