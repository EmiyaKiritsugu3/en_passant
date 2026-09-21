import { expect, type Page, type Locator } from "@playwright/test";

// Clicks board squares by chess coordinates (orientation: white).
// Chessground squares carry no coordinate attributes, so click by geometry.
export async function clickSquare(board: Locator, square: string) {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = parseInt(square[1], 10);
  const box = await board.boundingBox();
  if (!box) throw new Error("board has no bounding box");
  const s = box.width / 8;
  await board.click({
    position: { x: (file + 0.5) * s, y: (8 - rank + 0.5) * s },
  });
}

export async function gotoArenaAsWhite(page: Page) {
  await page.goto("/play?side=white");
  const board = page.locator(".cg-wrap");
  await expect(board).toBeVisible();
  return board;
}
