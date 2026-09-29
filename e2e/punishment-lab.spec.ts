import { test, expect } from "@playwright/test";

test.describe("Caça-erros & Socratic Ladder", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });
  });

  test("complete ladder flow: recognize → hint → reveal → review save", async ({ page }) => {
    await page.goto("/trainer/punishment");

    // Header & Drills bar
    await expect(page.getByText("Caça-erros")).toBeVisible();
    await expect(page.getByRole("heading", { name: "London System" })).toBeVisible();

    // Board container renders
    const board = page.locator(".cg-wrap");
    await expect(board).toBeVisible();
    await expect(board.locator("piece.white").first()).toBeVisible();

    // Stage 1: Recognition
    await expect(page.getByText(/Estágio 1 — Reconhecimento/i)).toBeVisible();
    const sawErrorBtn = page.getByRole("button", { name: /vi o erro/i });
    const missedErrorBtn = page.getByRole("button", { name: /não vi/i });
    await expect(sawErrorBtn).toBeVisible();
    await expect(missedErrorBtn).toBeVisible();

    // Student didn't see error → request hints (Socratic ladder)
    await missedErrorBtn.click();
    await expect(page.getByText(/Estágio 2 — Dica 1\/4/i)).toBeVisible();

    // Request next hint
    const nextHintBtn = page.getByRole("button", { name: /próxima dica/i });
    await expect(nextHintBtn).toBeVisible();
    await nextHintBtn.click();
    await expect(page.getByText(/Estágio 2 — Dica 2\/4/i)).toBeVisible();

    // Reveal the move
    const revealBtn = page.getByRole("button", { name: /mostrar solução/i });
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();

    // Stage Done: check reveal status & review save button
    await expect(page.getByText(/Revelado/i)).toBeVisible();
    const saveSm2Btn = page.getByRole("button", { name: /salvar para revisão/i });
    await expect(saveSm2Btn).toBeVisible();
    await saveSm2Btn.click();

    // Feedback confirms save & Next drill button appears
    await expect(page.getByText(/Salvo para revisar/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /próximo drill/i })).toBeVisible();

    // Verify review card was actually persisted to localStorage
    const storedCards = await page.evaluate(() => localStorage.getItem("cards.v1"));
    expect(storedCards).not.toBeNull();
    const cards = JSON.parse(storedCards!);
    expect(cards).toHaveLength(1);
    expect(cards[0].context).toBe("London System");
  });

  test("switch drill variation resets board and stage", async ({ page }) => {
    await page.goto("/trainer/punishment");

    // Wait for client hydration on the board
    await expect(page.locator(".cg-wrap piece").first()).toBeVisible();

    // Initial recognize stage
    await expect(page.getByText(/Estágio 1 — Reconhecimento/i)).toBeVisible();

    // Progress to hint
    await page.getByRole("button", { name: /não vi/i }).click();
    await expect(page.getByText(/Estágio 2 — Dica/i)).toBeVisible();

    // Select second drill variation
    const drillButtons = page.locator(".flex.flex-wrap.gap-2 button");
    await expect(drillButtons.first()).toBeVisible();
    await drillButtons.nth(1).click();

    // Should reset back to Stage 1
    await expect(page.getByText(/Estágio 1 — Reconhecimento/i)).toBeVisible();
  });
});
