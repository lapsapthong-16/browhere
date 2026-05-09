import { expect, test } from "@playwright/test";

import { placeholderProviderErrorQuery } from "../src/search/LocalPlaceholderSearchProvider";

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

test("search workflow covers loading, ranked results, empty state, provider error, and repeated searches", async ({
  page,
}) => {
  const budgetQuery = "quarterly budget spreadsheet from March";
  const emptyQuery = "invoice for submarine parts";
  const photoQuery = "team offsite photo from whiteboard";

  await page.goto("/");

  const searchbox = page.getByRole("searchbox", { name: /describe the file/i });
  const searchButton = page.getByRole("button", { name: "Search" });

  await searchbox.fill(budgetQuery);
  await searchbox.press("Enter");

  await expect(page.getByText(`Searching for "${budgetQuery}"...`)).toBeVisible();
  await expect(page.getByRole("option").first()).toContainText(
    "Q1 Budget Forecast.xlsx",
  );
  await expect(page.getByRole("option").nth(1)).toContainText(
    "Q1 Travel Budget.docx",
  );
  await expect(
    page.getByText(`Showing results for "${budgetQuery}".`),
  ).toBeVisible();

  await searchbox.fill(emptyQuery);
  await searchButton.click();

  await expect(page.getByText(`No matches for "${emptyQuery}".`)).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);

  await searchbox.fill(placeholderProviderErrorQuery);
  await searchbox.press("Enter");

  await expect(page.getByRole("alert")).toContainText(
    `Search failed for "${placeholderProviderErrorQuery}": Search is temporarily unavailable.`,
  );

  await searchbox.fill(photoQuery);
  await searchButton.click();

  await expect(page.getByRole("option").first()).toContainText(
    "Team Offsite Whiteboard.png",
  );
  await expect(
    page.getByText(`Showing results for "${photoQuery}".`),
  ).toBeVisible();
  await expect(searchbox).toHaveValue(photoQuery);
});
