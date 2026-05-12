import { expect, test } from "@playwright/test";

import { placeholderProviderErrorQuery } from "../src/search/LocalPlaceholderSearchProvider";

type RecordedAction = {
  action: "open" | "reveal";
  displayName: string;
};

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

test("keyboard navigation reaches results and mocked file actions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __browhereActionCalls: RecordedAction[];
      __browhereDesktopFileActions: unknown;
    };

    testWindow.__browhereActionCalls = [];
    testWindow.__browhereDesktopFileActions = {
      async openFile(result: { displayName: string }) {
        testWindow.__browhereActionCalls.push({
          action: "open",
          displayName: result.displayName,
        });

        return { ok: true, value: undefined };
      },
      async revealInFolder(result: { displayName: string }) {
        testWindow.__browhereActionCalls.push({
          action: "reveal",
          displayName: result.displayName,
        });

        return { ok: true, value: undefined };
      },
    };
  });

  await page.goto("/");

  const searchbox = page.getByRole("searchbox", { name: /describe the file/i });
  const searchButton = page.getByRole("button", { name: "Search" });

  await searchbox.fill("quarterly budget spreadsheet from March");
  await searchbox.press("Enter");

  await expect(page.getByRole("option").first()).toContainText(
    "Q1 Budget Forecast.xlsx",
  );
  await page.keyboard.press("Tab");
  await expect(searchButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("option").first()).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option").nth(1)).toBeFocused();
  await expect(page.getByRole("option").nth(1)).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.keyboard.press("Home");
  await expect(page.getByRole("option").first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Open Q1 Budget Forecast.xlsx" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const testWindow = window as Window & {
          __browhereActionCalls?: RecordedAction[];
        };

        return testWindow.__browhereActionCalls ?? [];
      }),
    )
    .toEqual([
      {
        action: "open",
        displayName: "Q1 Budget Forecast.xlsx",
      },
    ]);

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Show Q1 Budget Forecast.xlsx in folder" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const testWindow = window as Window & {
          __browhereActionCalls?: RecordedAction[];
        };

        return testWindow.__browhereActionCalls ?? [];
      }),
    )
    .toEqual([
      {
        action: "open",
        displayName: "Q1 Budget Forecast.xlsx",
      },
      {
        action: "reveal",
        displayName: "Q1 Budget Forecast.xlsx",
      },
    ]);
});

test("file action failure keeps the current e2e results visible", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __browhereDesktopFileActions: unknown;
    };

    testWindow.__browhereDesktopFileActions = {
      async openFile() {
        return {
          ok: false,
          error: {
            kind: "notFound",
            message: "The file could not be accessed.",
          },
        };
      },
      async revealInFolder() {
        return { ok: true, value: undefined };
      },
    };
  });

  await page.goto("/");

  const searchbox = page.getByRole("searchbox", { name: /describe the file/i });
  await searchbox.fill("quarterly budget spreadsheet from March");
  await searchbox.press("Enter");

  await expect(page.getByRole("option").first()).toContainText(
    "Q1 Budget Forecast.xlsx",
  );
  await page.getByRole("button", { name: "Open Q1 Budget Forecast.xlsx" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Could not open Q1 Budget Forecast.xlsx: The file could not be accessed.",
  );
  await expect(page.getByRole("option").first()).toContainText(
    "Q1 Budget Forecast.xlsx",
  );
  await expect(page.getByRole("option").nth(1)).toContainText(
    "Q1 Travel Budget.docx",
  );
});

test("visible shell controls stay scoped to desktop search workflow", async ({
  page,
}) => {
  await page.goto("/");

  const searchbox = page.getByRole("searchbox", { name: /describe the file/i });
  await searchbox.fill("quarterly budget spreadsheet from March");
  await searchbox.press("Enter");

  await expect(page.getByRole("option").first()).toContainText(
    "Q1 Budget Forecast.xlsx",
  );
  await expect(page.getByRole("button").filter({ hasText: /^(Search|Open|Show in folder)$/ })).toHaveText([
    "Search",
    "Open",
    "Show in folder",
    "Open",
    "Show in folder",
  ]);
  await expect(
    page.getByRole("button", {
      name: /add folder/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /update index/i })).toBeVisible();
  await expect(page.getByText(/gemini-embedding-2/i)).toBeVisible();
});
