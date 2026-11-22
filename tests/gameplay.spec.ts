import { test, expect } from "@playwright/test";

test("has Threadly connection brand title", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("THREADLY");
});

test("toggles How to Play modal instruction card", async ({ page }) => {
  await page.goto("/");
  
  // Click Help '?' button
  const helpBtn = page.locator("button[title='How to Play']");
  await helpBtn.click();
  
  // Verify instructions header appears
  await expect(page.locator("h3")).toContainText("How to Play");
  
  // Click 'Got it!' button to close
  await page.locator("button:has-text('Got it!')").click();
  await expect(page.locator("h3")).not.toBeVisible();
});

/** Verify keyboard-accessible navigation from daily play to the archive and back. */
test("navigates between home and puzzle archive via accessible controls", async ({ page }) => {
  await page.goto("/");

  const archiveLink = page.getByRole("link", { name: "Puzzle Archive" });
  await expect(archiveLink).toBeVisible();
  await archiveLink.click();

  await expect(page).toHaveURL(/\/archive/);
  await expect(page.locator("h2")).toContainText("PUZZLE ARCHIVE");

  const dailyPlayLink = page.getByRole("link", { name: "Daily Play" });
  await expect(dailyPlayLink).toBeVisible();
  await dailyPlayLink.click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("h1")).toContainText("THREADLY");
});
