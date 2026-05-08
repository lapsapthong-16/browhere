import { expect, test } from "@playwright/test";

test("initial launch shows the search utility without blocking onboarding", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("searchbox", { name: /describe the file/i }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: /search your files/i }),
  ).toBeVisible();
  await expect(page.getByText(/onboarding|marketing/i)).toHaveCount(0);
});
