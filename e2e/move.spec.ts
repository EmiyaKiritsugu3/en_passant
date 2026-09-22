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

test("player move e2-e4 registers on the board", async ({ page }) => {
  const board = await gotoArenaAsWhite(page);

  await clickSquare(board, "e2");
  await clickSquare(board, "e4");

  // Move history shows the played move (engine reply comes async, not asserted)
  const history = page.locator("#moves-list");
  await expect(history.getByRole("button", { name: "e4" })).toBeVisible({
    timeout: 10000,
  });
});
