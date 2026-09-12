import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
});

test("setup → play arena renders correctly", async ({ page }) => {
  await page.goto("/");

  // Check setup buttons
  const whiteBtn = page.getByRole("button", { name: /white/i });
  await expect(whiteBtn).toBeVisible();
  await expect(page.getByRole("button", { name: /black/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /random/i })).toBeVisible();

  // Navigate to arena as White
  await whiteBtn.click();
  await expect(page).toHaveURL(/\/play\?side=white/);

  // Check arena layout elements
  await expect(page.getByText("En Passant")).toBeVisible();
  await expect(page.getByRole("link", { name: /painel/i })).toBeVisible();
  await expect(page.getByText(/GM Coach|Stockfish/i).first()).toBeVisible();

  // Verify board container and chess pieces
  const board = page.locator(".cg-wrap");
  await expect(board).toBeVisible();
  await expect(board.locator("piece.white").first()).toBeVisible();
  await expect(board.locator("piece.black").first()).toBeVisible();
});

