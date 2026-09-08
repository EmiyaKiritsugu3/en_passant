"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import Board from "@/components/Board";

function PlayContent() {
  const searchParams = useSearchParams();
  const side = searchParams.get("side") ?? "white";
  const [color] = useState<"white" | "black">(() =>
    side === "random" ? (Math.random() < 0.5 ? "white" : "black") : (side as "white" | "black")
  );

  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(game.fen());
  const [notice, setNotice] = useState("");

  const onMove = (from: string, to: string) => {
    try {
      game.move({ from, to, promotion: "q" }); // throws on illegal
      setFen(game.fen());
      setNotice("");
    } catch {
      setFen(game.fen()); // unchanged -> piece snaps back
      setNotice(
        `Illegal move ${from}→${to}: blocked by chess.js legality rules. Choose a legal move.`
      );
    }
  };

  return (
    <main className="min-h-screen bg-[#161512] text-zinc-100 p-6 flex flex-col md:flex-row gap-6 justify-center items-start">
      <div className="flex flex-col gap-4 items-center">
        {side === "random" && (
          <p className="text-sm font-medium text-amber-400 bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-800/60">
            sorteio: você de {color === "white" ? "Brancas" : "Pretas"}
          </p>
        )}

        <Board fen={fen} orientation={color} onMove={onMove} />

        {notice && (
          <p
            role="alert"
            className="text-sm text-red-300 bg-red-950/60 border border-red-800/80 px-4 py-2 rounded-xl max-w-[560px]"
          >
            {notice}
          </p>
        )}

        <div className="w-full max-w-[560px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
          <div className="text-xs uppercase font-mono text-zinc-400 tracking-wider">FEN</div>
          <code className="text-xs font-mono text-amber-200/90 break-all bg-black/40 p-2 rounded-lg">
            {fen}
          </code>

          <div className="text-xs uppercase font-mono text-zinc-400 tracking-wider mt-2">PGN</div>
          <pre className="text-xs font-mono text-zinc-300 bg-black/40 p-2 rounded-lg whitespace-pre-wrap min-h-[40px]">
            {game.pgn() || "(game start)"}
          </pre>
        </div>
      </div>
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
