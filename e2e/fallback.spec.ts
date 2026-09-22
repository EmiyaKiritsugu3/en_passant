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

// Worker binary blocked: the mock engine must take over and the game advances.
test("mock fallback advances the game when WASM is unreachable", async ({ page }) => {
  await page.route("**/stockfish/*", (route) => route.abort());

  const board = await gotoArenaAsWhite(page);
  await clickSquare(board, "e2");
  await clickSquare(board, "e4");

  const history = page.locator("#moves-list");
  await expect(history.getByRole("button", { name: "e4" })).toBeVisible({
    timeout: 10000,
  });
  await expect(history.getByRole("button").nth(1)).not.toBeEmpty({
    timeout: 30000,
  });
});
