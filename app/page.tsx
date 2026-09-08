"use client";

import { useRouter } from "next/navigation";

export default function Setup() {
  const router = useRouter();
  const go = (side: string) => {
    const chosen = side === "random" ? (Math.random() < 0.5 ? "white" : "black") : side;
    router.push(`/play?side=${chosen}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#161512] text-zinc-100">
      <div className="w-full max-w-md bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 shadow-xl flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-xs uppercase tracking-widest text-amber-500 font-mono font-semibold">En Passant Coach</span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome to the board. Which side will you take today?
          </h1>
          <p className="text-sm text-zinc-400">Choose your color to begin the guided training match.</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => go("white")}
            className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.99] border border-zinc-700 text-white font-medium flex items-center justify-between transition-all"
          >
            <span>1. White</span>
            <span className="text-xs text-zinc-400">You play first</span>
          </button>

          <button
            type="button"
            onClick={() => go("black")}
            className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.99] border border-zinc-700 text-white font-medium flex items-center justify-between transition-all"
          >
            <span>2. Black</span>
            <span className="text-xs text-zinc-400">I play first</span>
          </button>

          <button
            type="button"
            onClick={() => go("random")}
            className="w-full py-3.5 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 active:scale-[0.99] border border-amber-600/40 font-medium flex items-center justify-between transition-all"
          >
            <span>3. Random</span>
            <span className="text-xs text-amber-400/80">Let chance decide</span>
          </button>
        </div>
      </div>
    </main>
  );
}
