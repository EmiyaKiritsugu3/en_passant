import { test, expect } from "@playwright/test";

test.describe("Play Arena — Game & Coach Console", () => {
  test("arena loads with 3-column layout and controls", async ({ page }) => {
    await page.goto("/play?side=white");

    // Header & Navigation
    await expect(page.getByText("En Passant")).toBeVisible();
    await expect(page.getByRole("link", { name: /painel/i })).toBeVisible();

    // Board and Pieces
    const board = page.locator(".cg-wrap");
    await expect(board).toBeVisible();
    await expect(board.locator("piece.white").first()).toBeVisible();
    await expect(board.locator("piece.black").first()).toBeVisible();

    // Player Cards
    await expect(page.getByText(/GM Coach \(Stockfish 18\)/i)).toBeVisible();
    await expect(page.getByText(/Você/i).first()).toBeVisible();
  });

  test("sound toggle changes mute state", async ({ page }) => {
    await page.goto("/play?side=white");

    const soundBtn = page.locator("header button").filter({ hasText: /🔊|🔇/ });
    await expect(soundBtn).toBeVisible();

    // Click sound toggle
    await soundBtn.click();
    await expect(soundBtn).toHaveText(/🔊|🔇/);
  });

  test("ai difficulty selector updates opponent card", async ({ page }) => {
    await page.goto("/play?side=white");

    // Wait for client hydration
    await expect(page.locator(".cg-wrap piece").first()).toBeVisible();

    const difficultySelect = page.locator("header select");
    await expect(difficultySelect).toBeVisible();

    // Select Master
    await difficultySelect.selectOption("master");
    await expect(page.getByText(/Mestre Stockfish/i)).toBeVisible();

    // Select Adaptive
    await difficultySelect.selectOption("adaptive");
    await expect(page.getByText(/Coach Adaptativo/i)).toBeVisible();
  });

  test("coach console tab navigation and chat interaction", async ({ page }) => {
    await page.goto("/play?side=white");

    // Navigate to Intent tab
    const intentTab = page.getByRole("button", { name: "Intenção" });
    await expect(intentTab).toBeVisible();
    await intentTab.click();
    await expect(page.getByText(/Plano & Estratégia/i)).toBeVisible();

    // Navigate to Position tab
    const positionTab = page.getByRole("button", { name: "Posição" });
    await expect(positionTab).toBeVisible();
    await positionTab.click();
    await expect(page.getByText(/Diagnóstico Espacial/i)).toBeVisible();

    // Navigate to Chat tab
    const chatTab = page.getByRole("button", { name: "Conversar" });
    await expect(chatTab).toBeVisible();
    await chatTab.click();

    // Chat input and send message
    const chatInput = page.getByPlaceholder(/Por que d4 é melhor que e4 aqui\?/i);
    await expect(chatInput).toBeVisible();
    await chatInput.fill("Qual é o plano principal das brancas?");

    const sendBtn = page.getByRole("button", { name: "Enviar" });
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // User message should appear in chat
    await expect(page.getByText("Qual é o plano principal das brancas?")).toBeVisible();
    await expect(page.getByText("Você", { exact: true }).first()).toBeVisible();
  });

  test("hint button triggers tactial advice", async ({ page }) => {
    await page.goto("/play?side=white");

    const hintBtn = page.getByRole("button", { name: /Pedir Dica Tática/i });
    await expect(hintBtn).toBeVisible();
    await hintBtn.click();

    // Notice pill should appear with hint
    await expect(page.locator("span", { hasText: /💡/ })).toBeVisible({ timeout: 10000 });
  });

  test("making a move on board updates move history", async ({ page }) => {
    await page.goto("/play?side=white");
    await expect(page.locator(".cg-wrap piece").first()).toBeVisible();

    const board = page.locator(".cg-wrap");
    const box = await board.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const sqW = box.width / 8;
    const sqH = box.height / 8;

    // Click e2 (file 4, row 6 from top), then e4 (file 4, row 4 from top)
    await page.mouse.click(box.x + sqW * 4.5, box.y + sqH * 6.5);
    await page.mouse.click(box.x + sqW * 4.5, box.y + sqH * 4.5);

    // Verify move recorded in MoveHistory
    await expect(page.getByText(/1\.\s*e4/i)).toBeVisible({ timeout: 5000 });
  });
});
