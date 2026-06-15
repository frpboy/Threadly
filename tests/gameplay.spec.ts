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
