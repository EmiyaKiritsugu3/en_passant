import { test, expect } from "@playwright/test";

test.describe("Dashboard & Analytics", () => {
  test("renders student analytics and navigation", async ({ page }) => {
    await page.goto("/dashboard");

    // Header
    await expect(page.getByText("En Passant Analytics")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Painel do Aluno" })).toBeVisible();

    // Stats Grid
    await expect(page.getByText("Rating", { exact: true })).toBeVisible();
    await expect(page.getByText("Partidas", { exact: true })).toBeVisible();
    await expect(page.getByText("Erros Táticos", { exact: true })).toBeVisible();
    await expect(page.getByText("Erros em Finais", { exact: true })).toBeVisible();

    // Accuracy by Phase
    await expect(page.getByText(/Precisão por Fase/i)).toBeVisible();
    await expect(page.getByText("Abertura").first()).toBeVisible();
    await expect(page.getByText("Meio-jogo").first()).toBeVisible();
    await expect(page.getByText("Final").first()).toBeVisible();

    // Training Recommendation & Daily Review (SM-2)
    await expect(page.getByText(/Plano de Treino Recomendado/i)).toBeVisible();
    await expect(page.getByText(/Revisão Diária/i)).toBeVisible();

    // Skills Radar
    await expect(page.getByText(/Radar de Habilidades/i)).toBeVisible();
    await expect(page.getByText("Tática")).toBeVisible();
    await expect(page.getByText("Seg. do Rei")).toBeVisible();

    // Navigation back to Setup
    const newGameBtn = page.getByRole("link", { name: /nova partida/i });
    await expect(newGameBtn).toBeVisible();
    await newGameBtn.click();
    await expect(page).toHaveURL("/");
  });

  test("daily review card navigates to punishment or training", async ({ page }) => {
    await page.goto("/dashboard");

    const reviewCard = page.locator("a", { hasText: /revisão diária/i });
    await expect(reviewCard).toBeVisible();
    await reviewCard.click();

    // Should navigate to either /train or /trainer/punishment
    await expect(page).toHaveURL(/\/(train|trainer\/punishment)/);
  });
});
