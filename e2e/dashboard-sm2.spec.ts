import { test, expect } from "@playwright/test";

test.describe("Dashboard & Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });
  });

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
    await expect(page.getByText(/Você ainda não tem partidas registradas/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Jogar Agora/i })).toHaveAttribute("href", "/play");
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

  test("daily review card navigates to /trainer/punishment when no cards due", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("cards.v1", JSON.stringify([]));
    });
    await page.goto("/dashboard");

    const reviewCard = page.locator("a", { hasText: /revisão diária/i });
    await expect(reviewCard).toBeVisible();
    await reviewCard.click();
    await expect(page).toHaveURL("/trainer/punishment");
  });

  test("daily review card navigates to /train when cards are due", async ({ page }) => {
    await page.addInitScript(() => {
      const card = {
        id: "test-card-1",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        bestMove: "e2e4",
        context: "Openings",
        interval: 1,
        reps: 1,
        EF: 2.5,
        nextReview: Date.now() - 86400000,
      };
      localStorage.setItem("cards.v1", JSON.stringify([card]));
    });
    await page.goto("/dashboard");

    const reviewCard = page.locator("a", { hasText: /revisão diária/i });
    await expect(reviewCard).toBeVisible();
    await expect(reviewCard).toHaveAttribute("href", "/train");
    await reviewCard.click();
    await expect(page).toHaveURL("/train");
  });

  test("shows tailored training plan when profile has games", async ({ page }) => {
    await page.addInitScript(() => {
      const profile = {
        version: 1,
        rating: 1250,
        games: 3,
        errorTags: { tactics: 4, kingSafety: 2, pawns: 1, endgame: 0 },
        recentErrorFens: [],
        openings: {},
        phaseHistory: [
          { game: 1, opening: 80, middlegame: 60, endgame: 50 },
          { game: 2, opening: 70, middlegame: 55, endgame: 40 },
          { game: 3, opening: 85, middlegame: 65, endgame: 30 },
        ],
      };
      localStorage.setItem("profile.v1", JSON.stringify(profile));
    });
    await page.goto("/dashboard");

    await expect(page.getByText(/Foco prioritário na fase de/i)).toBeVisible();
    await expect(page.getByText(/Final/i).first()).toBeVisible();
    await expect(page.getByText(/#tactics/i)).toBeVisible();
  });

  test("library shows unified empty state with CTAs when no games recorded", async ({ page }) => {
    await page.goto("/library");

    await expect(page.getByText("Sua Biblioteca está Vazia")).toBeVisible();
    await expect(page.getByRole("link", { name: /Jogar na Arena/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /\+ Importar PGN/i })).toBeVisible();
  });
});
