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

test("home command center renders all 5 training modules and navigation", async ({ page }) => {
  await page.goto("/");

  // Header & Brand
  await expect(page.getByText("Command Center")).toBeVisible();
  await expect(page.getByRole("link", { name: "Painel", exact: true })).toBeVisible();

  // Student Profile Quick Stats
  await expect(page.getByText("Perfil do Jogador")).toBeVisible();
  await expect(page.getByText("Rating ELO")).toBeVisible();

  // Training Modules Section
  await expect(page.getByText("Módulos de Treinamento")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Arena GM", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Punishment Lab", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Treino Diário SM-2", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Estudo Clássico", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Biblioteca de Jogos", exact: true })).toBeVisible();

  // Click on a module card (e.g. Punishment Lab)
  const punishmentCard = page.locator("a", { hasText: "Punishment Lab" }).first();
  await expect(punishmentCard).toBeVisible();
  await punishmentCard.click();
  await expect(page).toHaveURL("/trainer/punishment");
});

