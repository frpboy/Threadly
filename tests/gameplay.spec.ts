import { test, expect } from "@playwright/test";

test("has Threadly connection brand title", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("THREADLY");
});

test("toggles How to Play modal instruction card", async ({ page }) => {
  await page.goto("/");
  
  // Click Help '?' button
  const helpBtn = page.locator("button[title='How to Play']");
  await expect(helpBtn).toHaveAttribute("aria-expanded", "false");
  await helpBtn.click();
  await expect(helpBtn).toHaveAttribute("aria-expanded", "true");
  
  // Verify instructions header appears
  await expect(page.locator("h3")).toContainText("How to Play");
  
  // Click 'Got it!' button to close
  await page.locator("button:has-text('Got it!')").click();
  await expect(page.locator("h3")).not.toBeVisible();
  await expect(helpBtn).toHaveAttribute("aria-expanded", "false");
});

test("accessible guess input and disabled submit button when empty", async ({ page }) => {
  await page.goto("/");

  const guessInput = page.getByLabel("What is the connection?");
  await expect(guessInput).toBeVisible();

  const submitButton = page.getByRole("button", { name: "Submit Guess" });
  await expect(submitButton).toBeDisabled();

  await guessInput.fill("Space");
  await expect(submitButton).toBeEnabled();

  await guessInput.fill("   ");
  await expect(submitButton).toBeDisabled();
});
