import { test, expect } from "@playwright/test";
import { clickSquare } from "./helpers";

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

  // Continue CTA goes to study lesson
  await page.getByRole("link", { name: /continuar/i }).first().click();
  await expect(page).toHaveURL(/\/study\?opening=/);
  await expect(page.getByText(/a ideia/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /jogar a linha/i })).toBeVisible();
});

test("study lesson completes idea → drill → hunt flow", async ({ page }) => {
  await page.goto("/study?opening=Italian%20Game");

  // Step 1: idea
  await expect(page.getByText(/a ideia/i)).toBeVisible();
  await page.getByRole("button", { name: /jogar a linha/i }).click();

  // Step 2: drill — white alternates moves, black auto-plays after each.
  // Chessground resolve o alvo via elementFromPoint: board precisa estar
  // centrado na viewport (TabBar fixa cobre a fileira 1; fora da dobra
  // o click não registra). Primeiro click após auto-move pode não
  // selecionar — retry até os destinos aparecerem.
  const board = page.locator(".cg-wrap");
  await expect(board).toBeVisible();

  async function centerBoard() {
    await board.evaluate((el) => el.scrollIntoView({ block: "center" }));
  }

  async function playMove(from: string, to: string) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await centerBoard();
      await clickSquare(board, from);
      try {
        await expect(page.locator("cg-board square.move-dest").first()).toBeVisible({ timeout: 800 });
        break;
      } catch {
        if (attempt === 3) throw new Error(`no move-dests after selecting ${from}`);
      }
    }
    await centerBoard();
    await clickSquare(board, to);
  }

  // Italian Game Giuoco Piano: e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O
  // (user plays white moves; black replies automatically)
  const whiteMoves = [["e2", "e4"], ["g1", "f3"], ["f1", "c4"], ["c2", "c3"], ["d2", "d3"], ["e1", "g1"]];
  for (let i = 0; i < whiteMoves.length; i++) {
    const [from, to] = whiteMoves[i];
    await playMove(from, to);
    if (i < whiteMoves.length - 1) {
      await expect(page.getByText(`Lance ${2 * (i + 1) + 1} de 11`)).toBeVisible({ timeout: 8000 });
    }
  }

  await expect(page.getByRole("button", { name: /caçar o erro/i })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: /caçar o erro/i }).click();

  // Step 3: hunt — trap "d5 prematuro", solution Nc3 (b1c3)
  await expect(page.getByText(/erraram com/i)).toBeVisible();
  await playMove("b1", "c3");
  await expect(page.getByRole("button", { name: /concluir lição/i })).toBeVisible();
});

