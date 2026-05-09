import type { KeyboardEvent, Ref } from "react";

import type { DesktopFileActions } from "../desktop/DesktopFileActions";
import type { SearchResult } from "../search/SearchProvider";

interface ResultItemProps {
  result: SearchResult;
  selected: boolean;
  tabIndex: 0 | -1;
  itemRef: Ref<HTMLDivElement>;
  fileActions: DesktopFileActions;
  onSelect: (resultId: string) => void;
  onMove: (direction: "previous" | "next" | "first" | "last") => void;
}

export function ResultItem({
  result,
  selected,
  tabIndex,
  itemRef,
  fileActions,
  onSelect,
  onMove,
}: ResultItemProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onMove("next");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onMove("previous");
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onMove("first");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onMove("last");
    }
  };

  return (
    <div
      className="result-item"
      ref={itemRef}
      role="option"
      aria-selected={selected}
      tabIndex={tabIndex}
      onClick={() => onSelect(result.id)}
      onFocus={() => onSelect(result.id)}
      onKeyDown={handleKeyDown}
      data-selected={selected ? "true" : "false"}
    >
      <div className="result-item-main">
        <div className="result-title-row">
          <h2>{result.displayName}</h2>
          <span className="result-file-type">{result.fileType}</span>
        </div>
        <p className="result-path">{getFolderPath(result.filePath)}</p>
        {result.matchContext ? (
          <p className="result-context">{result.matchContext.text}</p>
        ) : null}
      </div>
      <dl className="result-metadata" aria-label={`${result.displayName} metadata`}>
        {result.modifiedAt ? (
          <div>
            <dt>Modified</dt>
            <dd>{formatModifiedDate(result.modifiedAt)}</dd>
          </div>
        ) : null}
        {result.sizeBytes !== undefined ? (
          <div>
            <dt>Size</dt>
            <dd>{formatSize(result.sizeBytes)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="result-actions" aria-label={`${result.displayName} actions`}>
        <button
          type="button"
          disabled={!result.actions.canOpen}
          aria-label={`Open ${result.displayName}`}
          onClick={(event) => {
            event.stopPropagation();
            void fileActions.openFile(result);
          }}
        >
          Open
        </button>
        <button
          type="button"
          disabled={!result.actions.canReveal}
          aria-label={`Show ${result.displayName} in folder`}
          onClick={(event) => {
            event.stopPropagation();
            void fileActions.revealInFolder(result);
          }}
        >
          Show in folder
        </button>
      </div>
    </div>
  );
}

function getFolderPath(filePath: string): string {
  const separatorIndex = Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/"));

  if (separatorIndex < 0) {
    return filePath;
  }

  return filePath.slice(0, separatorIndex);
}

function formatModifiedDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
