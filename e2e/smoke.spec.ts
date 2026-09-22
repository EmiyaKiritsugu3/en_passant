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

  // Trail home: continue card + side buttons
  await expect(page.getByRole("heading", { name: /trilha de aberturas/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /continuar/i }).first()).toBeVisible();
  const whiteBtn = page.getByRole("button", { name: /^white$/i });
  await expect(whiteBtn).toBeVisible();
  await expect(page.getByRole("button", { name: /^black$/i })).toBeVisible();

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

test("home learn trail renders 8 openings with tab bar", async ({ page }) => {
  await page.goto("/");

  // Trail heading
  await expect(page.getByRole("heading", { name: /trilha de aberturas/i })).toBeVisible();

  // 8 trail nodes (4 white + 4 black)
  await expect(page.getByRole("list", { name: /trilha de aberturas/i })).toBeVisible();
  await expect(page.locator("ol li")).toHaveCount(8);
  await expect(page.getByText("Italian Game").first()).toBeVisible();

  // Bottom tab bar
  const nav = page.getByRole("navigation", { name: /navegação principal/i });
  await expect(nav.getByRole("link", { name: /aprender/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /jogar/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /revisar/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /você/i })).toBeVisible();

  // Continue CTA goes to study
  await page.getByRole("link", { name: /continuar/i }).first().click();
  await expect(page).toHaveURL(/\/study\?opening=/);
});

