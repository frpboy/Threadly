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

test("guess submit button is disabled when input is empty and has proper a11y labels", async ({ page }) => {
  await page.goto("/");

  // Check header buttons have accessible labels
  const themeBtn = page.locator("button[aria-label*='theme']");
  await expect(themeBtn).toBeVisible();

  const helpBtn = page.locator("button[aria-label='How to play instructions']");
  await expect(helpBtn).toBeVisible();

  // Find guess input
  const guessInput = page.getByLabel("Guess connection");
  await expect(guessInput).toBeVisible();

  // Submit button should be disabled when empty
  const submitBtn = page.locator("button[type='submit']");
  await expect(submitBtn).toBeDisabled();

  // Type a guess, submit button becomes enabled
  await guessInput.fill("science");
  await expect(submitBtn).toBeEnabled();

  // Clear input, button is disabled again
  await guessInput.fill("");
  await expect(submitBtn).toBeDisabled();
});
