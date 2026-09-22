// Copies the Stockfish single-thread lite build from the npm package into
// public/stockfish/ so the Web Worker can load it same-origin. Run via
// predev/prebuild. Source of truth for the filename is the engine constant
// STOCKFISH_FILE in lib/engine/engine.ts; this script resolves the matching
// files from the installed stockfish package version.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("stockfish/package.json"));
const { buildVersion } = require("stockfish/package.json");
const base = `stockfish-${buildVersion}-lite-single`;
const outDir = join(root, "public", "stockfish");

mkdirSync(outDir, { recursive: true });
for (const ext of [".js", ".wasm"]) {
  const src = join(pkgDir, "bin", base + ext);
  if (!existsSync(src)) throw new Error(`copy-stockfish: missing ${src}`);
  cpSync(src, join(outDir, base + ext));
}
console.log(`copy-stockfish: ${base}.js/.wasm -> public/stockfish/`);
