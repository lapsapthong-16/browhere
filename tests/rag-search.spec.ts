import { expect, test } from "@playwright/test";

test("renders local RAG search UI", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Search files")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Approved folders" })).toBeVisible();
  await expect(page.getByLabel("Folder path")).toBeVisible();
});
