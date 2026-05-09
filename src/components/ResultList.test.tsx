import { fireEvent, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import { ResultList } from "./ResultList";
import type { DesktopFileActions } from "../desktop/DesktopFileActions";
import { renderWithAppProviders } from "../test/test-utils";
import type { SearchResult } from "../search/SearchProvider";

describe("ResultList", () => {
  it("renders results in ranked order with available metadata and match context", () => {
    renderWithAppProviders(
      <ResultList
        results={[unrankedResults[1], unrankedResults[0]]}
        selectedId="budget"
        onSelectResult={() => undefined}
      />,
    );

    const rows = screen.getAllByRole("option");

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Q1 Budget Forecast.xlsx")).toBeInTheDocument();
    expect(within(rows[0]).getByText("xlsx")).toBeInTheDocument();
    expect(
      within(rows[0]).getByText("C:\\Users\\edw\\Documents\\Finance"),
    ).toBeInTheDocument();
    expect(within(rows[0]).getByText("Mar 28, 2026")).toBeInTheDocument();
    expect(
      within(rows[0]).getByText(/quarterly runway/i),
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText("Team Offsite Whiteboard.png")).toBeInTheDocument();
  });

  it("keeps rows usable when optional metadata is missing", () => {
    renderWithAppProviders(
      <ResultList
        results={[minimalResult]}
        selectedId={minimalResult.id}
        onSelectResult={() => undefined}
      />,
    );

    const row = screen.getByRole("option", { name: /scratch.txt/i });

    expect(row).toBeInTheDocument();
    expect(within(row).getByText("txt")).toBeInTheDocument();
    expect(within(row).getByText("C:\\Users\\edw\\Desktop")).toBeInTheDocument();
    expect(within(row).queryByText(/modified/i)).not.toBeInTheDocument();
  });

  it("marks selected results and supports keyboard movement", () => {
    const onSelectResult = vi.fn();

    renderWithAppProviders(
      <ResultList
        results={unrankedResults}
        selectedId="budget"
        onSelectResult={onSelectResult}
      />,
    );

    const selected = screen.getByRole("option", {
      name: /q1 budget forecast/i,
      selected: true,
    });

    expect(selected).toHaveAttribute("tabindex", "0");

    selected.focus();
    fireEvent.keyDown(selected, { key: "ArrowDown" });
    expect(onSelectResult).toHaveBeenCalledWith("whiteboard");
    expect(
      screen.getByRole("option", { name: /team offsite whiteboard/i }),
    ).toHaveFocus();

    fireEvent.keyDown(selected, { key: "End" });
    expect(onSelectResult).toHaveBeenLastCalledWith("whiteboard");
  });

  it("invokes open and reveal actions from explicit controls", () => {
    const fileActions = new CapturingFileActions();

    renderWithAppProviders(
      <ResultList
        results={[unrankedResults[0]]}
        selectedId="budget"
        onSelectResult={() => undefined}
        fileActions={fileActions}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /open q1 budget forecast/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /show q1 budget forecast.*folder/i }),
    );

    expect(fileActions.opened).toEqual(["budget"]);
    expect(fileActions.revealed).toEqual(["budget"]);
  });

  it("disables unavailable result actions", () => {
    const fileActions = new CapturingFileActions();

    renderWithAppProviders(
      <ResultList
        results={[minimalResult]}
        selectedId={minimalResult.id}
        onSelectResult={() => undefined}
        fileActions={fileActions}
      />,
    );

    expect(screen.getByRole("button", { name: /open scratch/i })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /show scratch.*folder/i }),
    ).toBeDisabled();
  });
});

const unrankedResults: SearchResult[] = [
  {
    id: "budget",
    rank: 1,
    filePath: "C:\\Users\\edw\\Documents\\Finance\\Q1 Budget Forecast.xlsx",
    displayName: "Q1 Budget Forecast.xlsx",
    fileType: "xlsx",
    modifiedAt: "2026-03-28T16:30:00.000Z",
    sizeBytes: 482344,
    matchContext: {
      kind: "snippet",
      text: "March budget forecast with quarterly runway and team spend notes.",
    },
    actions: {
      canOpen: true,
      canReveal: true,
    },
  },
  {
    id: "whiteboard",
    rank: 2,
    filePath: "C:\\Users\\edw\\Pictures\\Work\\Team Offsite Whiteboard.png",
    displayName: "Team Offsite Whiteboard.png",
    fileType: "png",
    matchContext: {
      kind: "caption",
      text: "Photo of a team offsite whiteboard with launch planning notes.",
    },
    actions: {
      canOpen: true,
      canReveal: true,
    },
  },
];

const minimalResult: SearchResult = {
  id: "minimal",
  rank: 1,
  filePath: "C:\\Users\\edw\\Desktop\\scratch.txt",
  displayName: "scratch.txt",
  fileType: "txt",
  actions: {
    canOpen: true,
    canReveal: false,
  },
};

class CapturingFileActions implements DesktopFileActions {
  readonly opened: string[] = [];
  readonly revealed: string[] = [];

  async openFile(result: SearchResult) {
    this.opened.push(result.id);
    return { ok: true as const, value: undefined };
  }

  async revealInFolder(result: SearchResult) {
    this.revealed.push(result.id);
    return { ok: true as const, value: undefined };
  }
}
