import { screen } from "@testing-library/react";

import { SearchStatusView } from "./SearchStatusView";
import { renderWithAppProviders } from "../test/test-utils";
import type { SearchState } from "../search/SearchProvider";

describe("SearchStatusView", () => {
  it("renders the initial state for starting a search", () => {
    renderStatus({ status: "initial", query: "" });

    expect(screen.getByText(/ready for a local file search/i)).toBeInTheDocument();
  });

  it("renders loading feedback for the active query", () => {
    renderStatus({ status: "loading", query: "budget spreadsheet" });

    expect(screen.getByText('Searching for "budget spreadsheet"...')).toBeInTheDocument();
  });

  it("renders ready empty feedback with the active query", () => {
    renderStatus({
      status: "empty",
      query: "purple invoice",
      readiness: { kind: "ready" },
    });

    expect(screen.getByText('No matches for "purple invoice".')).toBeInTheDocument();
  });

  it("renders not-ready empty feedback with a bounded user-safe reason", () => {
    renderStatus({
      status: "empty",
      query: "whiteboard photo",
      readiness: { kind: "notReady", reason: "providerUnavailable" },
    });

    expect(screen.getByText(/whiteboard photo/i)).toBeInTheDocument();
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/embedding|ocr|vector|provider diagnostics/i)).not.toBeInTheDocument();
  });

  it("renders error feedback without clearing the active query", () => {
    renderStatus({
      status: "error",
      query: "tax receipt",
      message: "Search service failed.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      'Search failed for "tax receipt": Search service failed.',
    );
  });
});

function renderStatus(state: SearchState) {
  renderWithAppProviders(<SearchStatusView state={state} />);
}
