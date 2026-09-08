"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import Board from "@/components/Board";
import {
  listGames,
  setNote,
  addAnalysis,
  deleteGame,
  saveGame,
  type SavedGame,
  type Analysis,
} from "@/lib/library/storage";
import { collectEvals, type Row } from "@/lib/postgame";
import { createMockEngine, createStockfishEngine, type Engine } from "@/lib/engine/engine";
import { loadProfile, type Profile } from "@/lib/profile/store";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";

export default function LibraryPage() {
  const [games, setGames] = useState<SavedGame[]>(() => listGames());
  const [selectedGameId, setSelectedGameId] = useState<string | null>(() => {
    const list = listGames();
    return list[0]?.id || null;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [currentPly, setCurrentPly] = useState(0);
  const [reanalyzeDepth, setReanalyzeDepth] = useState<number>(12);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [noteText, setNoteText] = useState(() => {
    const list = listGames();
    return list[0]?.note || "";
  });
  const [selectedAnalysisIdx, setSelectedAnalysisIdx] = useState<number>(() => {
    const list = listGames();
    return list[0] ? Math.max(0, list[0].analyses.length - 1) : 0;
  });
  const [importPgnText, setImportPgnText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [profile] = useState<Profile | null>(() => loadProfile());

  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    try {
      engineRef.current = createStockfishEngine();
    } catch {
      engineRef.current = createMockEngine();
    }
    return () => {
      engineRef.current?.quit();
    };
  }, []);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  // Parse moves from PGN
  const parsedMoves = useMemo(() => {
    if (!selectedGame) return [];
    try {
      const c = new Chess();
      c.loadPgn(selectedGame.pgn);
      return c.history({ verbose: true });
    } catch {
      return [];
    }
  }, [selectedGame]);

  // Replay board state
  const replayGame = useMemo(() => {
    const c = new Chess();
    for (let i = 0; i < currentPly && i < parsedMoves.length; i++) {
      c.move(parsedMoves[i].san);
    }
    return c;
  }, [parsedMoves, currentPly]);

  const currentAnalysis: Analysis | undefined =
    selectedGame && selectedGame.analyses.length > 0
      ? selectedGame.analyses[selectedAnalysisIdx]
      : undefined;

  const currentRows = (currentAnalysis?.rows ?? []) as Row[];
  const currentRow = currentRows.find((r) => r.ply === currentPly);

  // Best move arrow if available
  const boardShapes: DrawShape[] = useMemo(() => {
    if (!currentRow || !currentRow.best || currentRow.best.length < 4) return [];
    const orig = currentRow.best.slice(0, 2) as Key;
    const dest = currentRow.best.slice(2, 4) as Key;
    return [{ orig, dest, brush: "green" }];
  }, [currentRow]);

  const handleSelectGame = (g: SavedGame) => {
    setSelectedGameId(g.id);
    setCurrentPly(0);
    setNoteText(g.note || "");
    setSelectedAnalysisIdx(Math.max(0, g.analyses.length - 1));
  };

  const handleSaveNote = () => {
    if (!selectedGameId) return;
    setNote(selectedGameId, noteText);
    setGames(listGames());
  };

  const handleDelete = (id: string) => {
    deleteGame(id);
    const updated = listGames();
    setGames(updated);
    if (selectedGameId === id) {
      setSelectedGameId(updated[0]?.id || null);
      setCurrentPly(0);
      setNoteText(updated[0]?.note || "");
    }
  };

  const handleReanalyze = async () => {
    if (!selectedGame) return;
    setIsReanalyzing(true);
    try {
      const engine = engineRef.current ?? createMockEngine();
      const rows = await collectEvals(selectedGame.pgn, engine);
      addAnalysis(selectedGame.id, { depth: reanalyzeDepth, rows });
      const updated = listGames();
      setGames(updated);
      const newly = updated.find((g) => g.id === selectedGame.id);
      if (newly) {
        setSelectedAnalysisIdx(newly.analyses.length - 1);
      }
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleImport = () => {
    if (!importPgnText.trim()) return;
    try {
      const c = new Chess();
      c.loadPgn(importPgnText.trim());
      const newId = saveGame(importPgnText.trim());
      const updated = listGames();
      setGames(updated);
      setSelectedGameId(newId);
      setCurrentPly(0);
      setImportPgnText("");
      setShowImport(false);
    } catch {
      alert("PGN inválido.");
    }
  };

  const filteredGames = games.filter((g) => {
    if (resultFilter !== "all" && g.result !== resultFilter) return false;
    if (searchQuery.trim() && !g.pgn.toLowerCase().includes(searchQuery.toLowerCase()) && !g.note.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Identify weakest tag for recommendations
  const weakestTag = useMemo(() => {
    if (!profile) return null;
    const entries = Object.entries(profile.errorTags) as [string, number][];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0] && entries[0][1] > 0 ? entries[0][0] : null;
  }, [profile]);

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-zinc-800 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-amber-500 font-semibold">
            Biblioteca Pessoal
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Partidas & Análises</h1>
        </div>

        <div className="flex gap-3">
          <Link
            href="/study"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800 transition-colors"
          >
            📖 Modo Estudo
          </Link>
          <Link
            href="/train"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Treinar
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Painel
          </Link>
          <Link
            href="/play"
            className="text-xs font-mono px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            Jogar
          </Link>
        </div>
      </header>

      {/* Weakest Tag Study Recommendation Banner */}
      {weakestTag && (
        <div className="w-full max-w-6xl mb-6 p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-mono uppercase text-amber-400 font-bold">Recomendação de Estudo</span>
            <p className="text-xs text-zinc-300 mt-0.5">
              Seu perfil aponta mais erros recentes em <strong>{weakestTag}</strong>. Pratique com partidas modelo selecionadas para dominar essa fraqueza.
            </p>
          </div>
          <Link
            href={`/study?tag=${weakestTag}`}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition-all whitespace-nowrap"
          >
            Ver Partidas de {weakestTag} →
          </Link>
        </div>
      )}

      {/* Main layout */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Games List & Filters (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase text-zinc-400">Partidas Gravadas ({games.length})</span>
              <button
                onClick={() => setShowImport((prev) => !prev)}
                className="text-xs font-mono text-amber-400 hover:underline"
              >
                {showImport ? "Fechar" : "+ Importar PGN"}
              </button>
            </div>

            {showImport && (
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col gap-2">
                <textarea
                  value={importPgnText}
                  onChange={(e) => setImportPgnText(e.target.value)}
                  placeholder="Cole o PGN aqui..."
                  className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs font-mono text-zinc-200 resize-none focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleImport}
                  className="py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  Importar Partida
                </button>
              </div>
            )}

            {/* Filter controls */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar lances ou notas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none"
              >
                <option value="all">Todos</option>
                <option value="1-0">1-0</option>
                <option value="0-1">0-1</option>
                <option value="1/2-1/2">½-½</option>
              </select>
            </div>

            {/* Games List */}
            <div className="max-h-[520px] overflow-y-auto flex flex-col gap-2 pr-1">
              {filteredGames.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  Nenhuma partida encontrada. Finalize uma partida no modo Jogar ou importe um PGN.
                </div>
              ) : (
                filteredGames.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => handleSelectGame(g)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-1.5 ${
                      selectedGameId === g.id
                        ? "bg-amber-500/15 border-amber-500/50 text-white"
                        : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex justify-between items-center font-mono">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          g.result === "1-0"
                            ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                            : g.result === "0-1"
                            ? "bg-rose-950 border border-rose-800 text-rose-300"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {g.result}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(g.date).toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    <p className="font-mono text-[11px] text-zinc-300 truncate">
                      {g.pgn}
                    </p>

                    <div className="flex justify-between items-center text-[10px] text-zinc-500">
                      <span>Análises: {g.analyses.length}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(g.id);
                        }}
                        className="text-rose-400 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Replay, Board, Analysis & Notebook (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selectedGame ? (
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
              {/* Top controls: Re-analyse bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase text-zinc-400">Versão:</span>
                  {selectedGame.analyses.length > 0 ? (
                    <div className="flex gap-1">
                      {selectedGame.analyses.map((an, idx) => (
                        <button
                          key={an.id}
                          onClick={() => setSelectedAnalysisIdx(idx)}
                          className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all ${
                            selectedAnalysisIdx === idx
                              ? "bg-amber-600 border-amber-500 text-white font-bold"
                              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                          }`}
                        >
                          v{idx + 1} (d{an.depth})
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-zinc-500">Sem análise</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-400">Profundidade:</span>
                  <select
                    value={reanalyzeDepth}
                    onChange={(e) => setReanalyzeDepth(Number(e.target.value))}
                    className="bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 rounded-lg px-2 py-1 focus:outline-none"
                  >
                    <option value={10}>10 (Rápida)</option>
                    <option value={14}>14 (Padrão)</option>
                    <option value={18}>18 (Profunda)</option>
                  </select>
                  <button
                    onClick={handleReanalyze}
                    disabled={isReanalyzing}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    {isReanalyzing ? "Analisando..." : "Nova Análise"}
                  </button>
                </div>
              </div>

              {/* Board + Moves Navigator */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                  <Board
                    fen={replayGame.fen()}
                    orientation="white"
                    shape={boardShapes}
                  />

                  {/* Navigation controls */}
                  <div className="flex gap-2 w-full max-w-[480px]">
                    <button
                      onClick={() => setCurrentPly(0)}
                      disabled={currentPly === 0}
                      className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                    >
                      |&lt;
                    </button>
                    <button
                      onClick={() => setCurrentPly((p) => Math.max(0, p - 1))}
                      disabled={currentPly === 0}
                      className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                    >
                      &lt;
                    </button>
                    <button
                      onClick={() => setCurrentPly((p) => Math.min(parsedMoves.length, p + 1))}
                      disabled={currentPly >= parsedMoves.length}
                      className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                    >
                      &gt;
                    </button>
                    <button
                      onClick={() => setCurrentPly(parsedMoves.length)}
                      disabled={currentPly >= parsedMoves.length}
                      className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300"
                    >
                      &gt;|
                    </button>
                  </div>
                </div>

                {/* Right panel: Moves replay table & Current move evaluation */}
                <div className="flex-1 flex flex-col gap-4 w-full">
                  {/* Current move eval badge */}
                  {currentRow && (
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-mono flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">
                          Lance {currentRow.ply}: <strong>{currentRow.san}</strong>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            currentRow.label === "brilliant"
                              ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                              : currentRow.label === "best"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : currentRow.label === "inaccuracy"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : currentRow.label === "mistake"
                              ? "bg-orange-950 text-orange-300 border border-orange-800"
                              : currentRow.label === "blunder"
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {currentRow.label.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Perda CP: <span className="text-rose-400 font-bold">{currentRow.cpLoss}</span> | Fase: {currentRow.phase}
                      </div>
                      {currentRow.best && (
                        <div className="text-[11px] text-emerald-400">
                          Melhor lance alternativo: <strong>{currentRow.best}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Moves scroll list */}
                  <div className="max-h-60 overflow-y-auto p-2 bg-zinc-950 rounded-xl border border-zinc-800 grid grid-cols-2 gap-1 font-mono text-xs">
                    {parsedMoves.map((m, idx) => {
                      const plyNum = idx + 1;
                      const isSelected = plyNum === currentPly;
                      const moveEval = currentRows.find((r) => r.ply === plyNum);
                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrentPly(plyNum)}
                          className={`px-2 py-1 rounded text-left flex justify-between items-center transition-all ${
                            isSelected
                              ? "bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold"
                              : "hover:bg-zinc-900 text-zinc-300"
                          }`}
                        >
                          <span>
                            {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : "..."}
                            {m.san}
                          </span>
                          {moveEval && moveEval.label !== "book" && moveEval.label !== "good" && (
                            <span
                              className={`text-[9px] px-1 rounded ${
                                moveEval.label === "blunder"
                                  ? "bg-rose-900/60 text-rose-300"
                                  : moveEval.label === "mistake"
                                  ? "bg-orange-900/60 text-orange-300"
                                  : moveEval.label === "inaccuracy"
                                  ? "bg-amber-900/60 text-amber-300"
                                  : "bg-emerald-900/60 text-emerald-300"
                              }`}
                            >
                              {moveEval.label[0].toUpperCase()}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Notebook Textarea */}
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="text-xs font-mono uppercase text-zinc-400">Caderno de Anotações</span>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Anote suas impressões, lições e ideias sobre esta partida..."
                      className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 resize-none focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveNote}
                        className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold rounded-lg transition-all border border-zinc-700"
                      >
                        Salvar Anotação
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 text-xs">
              Selecione uma partida na lista à esquerda para analisar e revisar.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
