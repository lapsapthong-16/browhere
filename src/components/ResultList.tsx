import { useMemo, useRef } from "react";

import { ResultItem } from "./ResultItem";
import type { ResultActionFailure } from "./ResultItem";
import type { DesktopFileActions } from "../desktop/DesktopFileActions";
import type { SearchResult } from "../search/SearchProvider";

interface ResultListProps {
  results: SearchResult[];
  selectedId?: string;
  fileActions?: DesktopFileActions;
  onActionFailure?: (failure: ResultActionFailure) => void;
  onSelectResult: (resultId: string) => void;
}

export function ResultList({
  results,
  selectedId,
  fileActions = noopFileActions,
  onActionFailure,
  onSelectResult,
}: ResultListProps) {
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const rankedResults = useMemo(
    () => [...results].sort((left, right) => left.rank - right.rank),
    [results],
  );
  const activeSelectedId = selectedId ?? rankedResults[0]?.id;
  const selectedIndex = Math.max(
    0,
    rankedResults.findIndex((result) => result.id === activeSelectedId),
  );

  const moveSelection = (direction: "previous" | "next" | "first" | "last") => {
    if (rankedResults.length === 0) {
      return;
    }

    const nextIndex = getNextIndex(direction, selectedIndex, rankedResults.length);
    const nextId = rankedResults[nextIndex].id;

    onSelectResult(nextId);
    itemRefs.current.get(nextId)?.focus();
  };

  if (rankedResults.length === 0) {
    return null;
  }

  return (
    <section className="result-list-section" aria-labelledby="result-list-title">
      <h2 id="result-list-title">Ranked results</h2>
      <div className="result-list" role="listbox" aria-label="Search results">
        {rankedResults.map((result) => {
          const selected = result.id === activeSelectedId;

          return (
            <ResultItem
              key={result.id}
              result={result}
              selected={selected}
              tabIndex={selected ? 0 : -1}
              fileActions={fileActions}
              onActionFailure={onActionFailure}
              itemRef={(element) => {
                if (element) {
                  itemRefs.current.set(result.id, element);
                  return;
                }

                itemRefs.current.delete(result.id);
              }}
              onSelect={onSelectResult}
              onMove={moveSelection}
            />
          );
        })}
      </div>
    </section>
  );
}

const noopFileActions: DesktopFileActions = {
  async openFile() {
    return { ok: true, value: undefined };
  },
  async revealInFolder() {
    return { ok: true, value: undefined };
  },
};

function getNextIndex(
  direction: "previous" | "next" | "first" | "last",
  selectedIndex: number,
  resultCount: number,
): number {
  if (direction === "first") {
    return 0;
  }

  if (direction === "last") {
    return resultCount - 1;
  }

  if (direction === "previous") {
    return Math.max(0, selectedIndex - 1);
  }

  return Math.min(resultCount - 1, selectedIndex + 1);
}
