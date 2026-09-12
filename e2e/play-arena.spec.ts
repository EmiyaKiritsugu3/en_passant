import { test, expect } from "@playwright/test";

test.describe("Play Arena — Game & Coach Console", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    });
  });

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

    // A11y landmarks
    await expect(page.getByRole("heading", { level: 1, name: /Arena GM/i })).toBeAttached();
    await expect(page.getByRole("region", { name: /Tabuleiro e oponente/i })).toBeVisible();
    await expect(page.getByRole("region", { name: /Lances e coach/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /Tabuleiro de xadrez/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /Barra de avaliação/i })).toBeVisible();
  });

  test("sound toggle changes mute state", async ({ page }) => {
    await page.goto("/play?side=white");

    const soundBtn = page.locator("header button").filter({ hasText: /🔊|🔇/ });
    await expect(soundBtn).toBeVisible();
    await expect(soundBtn).toHaveAttribute("title", "Desativar som");

    // Click sound toggle -> mutes audio
    await soundBtn.click();
    await expect(soundBtn).toHaveAttribute("title", "Ativar som");

    // Click again -> unmutes audio
    await soundBtn.click();
    await expect(soundBtn).toHaveAttribute("title", "Desativar som");
    await expect(soundBtn).toHaveAttribute("aria-pressed", "true");

    // Transport controls expose accessible names
    await expect(page.getByRole("button", { name: "Lance anterior" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inverter orientação do tabuleiro" })).toBeVisible();
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

    // Tabs expose tab semantics
    await expect(page.getByRole("tablist", { name: /Seções do coach/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Crítica" })).toHaveAttribute("aria-selected", "true");

    // Navigate to Intent tab
    const intentTab = page.getByRole("tab", { name: "Intenção" });
    await expect(intentTab).toBeVisible();
    await intentTab.click();
    await expect(page.getByRole("tab", { name: "Intenção" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/Plano & Estratégia/i)).toBeVisible();

    // Navigate to Position tab
    const positionTab = page.getByRole("tab", { name: "Posição" });
    await expect(positionTab).toBeVisible();
    await positionTab.click();
    await expect(page.getByText(/Diagnóstico Espacial/i)).toBeVisible();

    // Navigate to Chat tab
    const chatTab = page.getByRole("tab", { name: "Conversar" });
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
    await expect(page.locator(".bg-amber-600\\/20").getByText("Você")).toBeVisible();
  });

  test("hint button triggers tactial advice", async ({ page }) => {
    await page.goto("/play?side=white");

    const hintBtn = page.getByRole("button", { name: /Pedir Dica Tática/i });
    await expect(hintBtn).toBeVisible();
    await hintBtn.click();

    // Notice pill should appear with hint generated text
    await expect(page.getByText(/Dica GM:/i)).toBeVisible({ timeout: 10000 });
  });

  test("making a move on board updates move history", async ({ page }) => {
    await page.goto("/play?side=white");
    await expect(page.locator(".cg-wrap piece").first()).toBeVisible();

    const board = page.locator(".cg-wrap");
    const box = await board.boundingBox();
    expect(box).not.toBeNull();
    const { x, y, width, height } = box!;

    const sqW = width / 8;
    const sqH = height / 8;

    // Click e2 (file 4, row 6 from top), then e4 (file 4, row 4 from top)
    await page.mouse.click(x + sqW * 4.5, y + sqH * 6.5);
    await page.mouse.click(x + sqW * 4.5, y + sqH * 4.5);

    // Verify move recorded in MoveHistory
    await expect(page.getByText(/1\.\s*e4/i)).toBeVisible({ timeout: 5000 });
  });
});
