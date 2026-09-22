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

  test("renders student progress and navigation", async ({ page }) => {
    await page.goto("/dashboard");

    // Header
    await expect(page.getByRole("heading", { name: "Seu progresso" })).toBeVisible();

    // Stats Grid
    await expect(page.getByText("Pontos", { exact: true })).toBeVisible();
    await expect(page.getByText("Partidas", { exact: true })).toBeVisible();
    await expect(page.getByText("Aberturas concluídas", { exact: true })).toBeVisible();
    await expect(page.getByText("Revisão pendente", { exact: true })).toBeVisible();

    // Precision by phase
    await expect(page.getByRole("heading", { name: /Precisão por fase/i })).toBeVisible();
    await expect(page.getByText("Abertura").first()).toBeVisible();
    await expect(page.getByText("Meio-jogo").first()).toBeVisible();
    await expect(page.getByText("Final").first()).toBeVisible();

    // Recommendation & Daily Review
    await expect(page.getByText(/Jogue sua primeira partida para receber/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Jogar agora/i })).toHaveAttribute("href", "/play");
    await expect(page.getByText(/Revisão do dia/i)).toBeVisible();

    // Openings progress
    await expect(page.getByText(/Aberturas/i).first()).toBeVisible();

    // Navigation to trail
    const trailLink = page.getByRole("link", { name: /Ver trilha/i });
    await expect(trailLink).toBeVisible();
    await trailLink.click();
    await expect(page).toHaveURL("/");
  });

  test("daily review card navigates to /study when no cards due", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("cards.v1", JSON.stringify([]));
    });
    await page.goto("/dashboard");

    const reviewCard = page.locator("a", { hasText: /revisão do dia/i });
    await expect(reviewCard).toBeVisible();
    await reviewCard.click();
    await expect(page).toHaveURL("/study");
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

    const reviewCard = page.locator("a", { hasText: /revisão do dia/i });
    await expect(reviewCard).toBeVisible();
    await expect(reviewCard).toHaveAttribute("href", "/train");
    await reviewCard.click();
    await expect(page).toHaveURL("/train");
  });

  test("shows tailored recommendation when profile has games", async ({ page }) => {
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

    await expect(page.getByText(/Foco em/i)).toBeVisible();
    await expect(page.getByText(/Final/i).first()).toBeVisible();
    await expect(page.getByText(/tactics/i)).toBeVisible();
  });

  test("library shows unified empty state with CTAs when no games recorded", async ({ page }) => {
    await page.goto("/library");

    await expect(page.getByText("Sua Biblioteca está Vazia")).toBeVisible();
    await expect(page.getByRole("link", { name: /Jogar/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /\+ Importar PGN/i })).toBeVisible();
  });
});
