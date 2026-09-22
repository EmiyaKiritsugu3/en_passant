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

test("takeback removes one full move and restores the player turn", async ({ page }) => {
  const board = await gotoArenaAsWhite(page);

  await clickSquare(board, "e2");
  await clickSquare(board, "e4");

  const history = page.locator("#moves-list");
  await expect(history.getByRole("button", { name: "e4" })).toBeVisible({
    timeout: 10000,
  });
  // Wait for the engine reply so there is a full move to take back
  await expect(history.getByRole("button").nth(1)).not.toBeEmpty({
    timeout: 30000,
  });

  await page.getByRole("button", { name: "Voltar um lance" }).click();

  await expect(history.getByText("Nenhum lance jogado ainda")).toBeVisible({
    timeout: 5000,
  });
  // Board is back to start: e2 pawn clickable again with no dest highlight leftovers
  await clickSquare(board, "e2");
  await clickSquare(board, "e4");
  await expect(history.getByRole("button", { name: "e4" })).toBeVisible({
    timeout: 10000,
  });
});
