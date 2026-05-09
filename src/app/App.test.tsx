import { fireEvent, screen, waitFor } from "@testing-library/react";

import { App } from "./App";
import { renderWithAppProviders } from "../test/test-utils";
import type { DesktopFileActions } from "../desktop/DesktopFileActions";
import type {
  Result,
  SearchError,
  SearchProvider,
  SearchQuery,
  SearchResponse,
} from "../search/SearchProvider";

describe("App", () => {
  it("renders a first-screen desktop search surface", () => {
    renderWithAppProviders(<App />);

    expect(
      screen.getByRole("searchbox", { name: /describe the file/i }),
    ).toHaveFocus();
    expect(
      screen.getByRole("heading", { name: /search your files/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/marketing|onboarding/i)).not.toBeInTheDocument();
  });

  it("submits the exact typed query from the keyboard and keeps the input ready", async () => {
    const provider = new CapturingSearchProvider({ delayMs: 250 });
    renderWithAppProviders(<App searchProvider={provider} />);

    const input = screen.getByRole("searchbox", {
      name: /describe the file/i,
    });

    fireEvent.change(input, {
      target: { value: "  March budget spreadsheet  " },
    });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText(/searching for/i)).toHaveTextContent(
      /march budget spreadsheet/i,
    );

    await waitFor(() => {
      expect(provider.queries).toEqual(["  March budget spreadsheet  "]);
    });
    expect(await screen.findByText(/showing results/i)).toHaveTextContent(
      /march budget spreadsheet/i,
    );
    expect(input).toHaveValue("  March budget spreadsheet  ");
    expect(input).toHaveFocus();
  });

  it("supports repeated mouse submissions from the same window", async () => {
    const provider = new CapturingSearchProvider();
    renderWithAppProviders(<App searchProvider={provider} />);

    const input = screen.getByRole("searchbox", {
      name: /describe the file/i,
    });
    const submitButton = screen.getByRole("button", { name: /search/i });

    fireEvent.change(input, { target: { value: "invoice scan" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(provider.queries).toEqual(["invoice scan"]);
    });

    fireEvent.change(input, { target: { value: "tax receipt" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(provider.queries).toEqual(["invoice scan", "tax receipt"]);
    });
    expect(
      await screen.findByText(/showing results for "tax receipt"/i),
    ).toBeInTheDocument();
    expect(input).toHaveValue("tax receipt");
    expect(input).toHaveFocus();
  });

  it("keeps whitespace-only submissions on the search surface without searching", async () => {
    const provider = new CapturingSearchProvider();
    renderWithAppProviders(<App searchProvider={provider} />);

    const input = screen.getByRole("searchbox", {
      name: /describe the file/i,
    });

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("search", { name: /file search/i }));

    expect(provider.queries).toEqual([]);
    expect(input).toHaveValue("   ");
    expect(input).toHaveFocus();
    expect(
      screen.getByText(/ready for a local file search/i),
    ).toBeInTheDocument();
  });

  it("shows file action failures without clearing current results", async () => {
    const provider = new CapturingSearchProvider();
    const desktopFileActions = new FailingDesktopFileActions();

    renderWithAppProviders(
      <App searchProvider={provider} desktopFileActions={desktopFileActions} />,
    );

    const input = screen.getByRole("searchbox", {
      name: /describe the file/i,
    });

    fireEvent.change(input, { target: { value: "result" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("result.txt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open result/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not open result\.txt/i,
    );
    expect(screen.getByText("result.txt")).toBeInTheDocument();
    expect(
      screen.getByText("C:\\Users\\edw\\Documents"),
    ).toBeInTheDocument();
  });
});

class CapturingSearchProvider implements SearchProvider {
  readonly queries: string[] = [];

  constructor(private readonly options: { delayMs?: number } = {}) {}

  async search(
    query: SearchQuery,
  ): Promise<Result<SearchResponse, SearchError>> {
    this.queries.push(query.text);

    if (this.options.delayMs !== undefined) {
      await new Promise((resolve) => {
        setTimeout(resolve, this.options.delayMs);
      });
    }

    return {
      ok: true,
      value: {
        readiness: { kind: "ready" },
        results: [
          {
            id: `result-${this.queries.length}`,
            rank: 1,
            filePath: "C:\\Users\\edw\\Documents\\result.txt",
            displayName: "result.txt",
            fileType: "txt",
            actions: {
              canOpen: true,
              canReveal: true,
            },
          },
        ],
      },
    };
  }
}

class FailingDesktopFileActions implements DesktopFileActions {
  async openFile() {
    return {
      ok: false as const,
      error: {
        kind: "notFound" as const,
        message: "The file could not be found.",
      },
    };
  }

  async revealInFolder() {
    return {
      ok: false as const,
      error: {
        kind: "osFailure" as const,
        message: "Explorer could not open the folder.",
      },
    };
  }
}
