"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-mono text-xs text-base-400">
      <p>Algo quebrou neste lance. O tabuleiro foi preservado.</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-base-800 hover:bg-base-700 text-base-100 border border-base-700"
      >
        Tentar de novo
      </button>
    </div>
  );
}
