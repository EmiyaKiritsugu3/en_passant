import { test, expect } from "@playwright/test";

test("setup → play renders", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /white/i }).click();
  await expect(page).toHaveURL(/\/play\?side=white/);
  await expect(page.locator("code").first()).toContainText("rnbqkbnr");
});
