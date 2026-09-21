import { test, expect } from "@playwright/test";
import { gotoArenaAsWhite, clickSquare } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
});

// Exercises the real Stockfish Web Worker end-to-end: after the player moves,
// the engine (black) must reply on its own. Falls back to the mock engine if
// WASM fails — either way the game loop must advance to 2 plies.
test("engine replies to e2-e4 (worker loop)", async ({ page }) => {
  // Prove the real Stockfish Worker boots (mock fallback spawns no Worker)
  const workerReady = page
    .waitForEvent("worker", {
      predicate: (w) => w.url().includes("stockfish"),
      timeout: 20000,
    })
    .then(() => true);

  const board = await gotoArenaAsWhite(page);
  await expect.poll(() => workerReady, { timeout: 20000 }).toBe(true);

  await clickSquare(board, "e2");
  await clickSquare(board, "e4");

  const history = page.locator("#moves-list");
  await expect(history.getByRole("button", { name: "e4" })).toBeVisible({
    timeout: 10000,
  });

  // Second button in the history = black engine reply (real Worker or mock)
  await expect(history.getByRole("button").nth(1)).not.toBeEmpty({
    timeout: 30000,
  });
});
