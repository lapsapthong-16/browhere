import { expect, test } from "@playwright/test";

test("renders local RAG search UI", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find files by memory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Approved folders" })).toBeVisible();
  await expect(page.getByText("Selected-folder text")).toBeVisible();
});
