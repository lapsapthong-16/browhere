import type { SearchResult } from "../search/SearchProvider";

export type PlaceholderResultEntry = {
  result: SearchResult;
  searchTerms: readonly string[];
};

export const placeholderResultEntries: readonly PlaceholderResultEntry[] = [
  {
    result: {
      id: "placeholder-budget-forecast",
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
    searchTerms: [
      "budget",
      "forecast",
      "quarterly",
      "spreadsheet",
      "march",
      "finance",
      "runway",
    ],
  },
  {
    result: {
      id: "placeholder-budget-notes",
      rank: 2,
      filePath: "C:\\Users\\edw\\Documents\\Finance\\Q1 Travel Budget.docx",
      displayName: "Q1 Travel Budget.docx",
      fileType: "docx",
      modifiedAt: "2026-03-15T09:10:00.000Z",
      matchContext: {
        kind: "explanation",
        text: "This document mentions quarterly budget planning and March travel estimates.",
      },
      actions: {
        canOpen: true,
        canReveal: true,
      },
    },
    searchTerms: [
      "budget",
      "quarterly",
      "march",
      "travel",
      "planning",
      "document",
    ],
  },
  {
    result: {
      id: "placeholder-offsite-whiteboard",
      rank: 3,
      filePath: "C:\\Users\\edw\\Pictures\\Work\\Team Offsite Whiteboard.png",
      displayName: "Team Offsite Whiteboard.png",
      fileType: "png",
      modifiedAt: "2026-04-11T18:45:00.000Z",
      sizeBytes: 1398421,
      matchContext: {
        kind: "caption",
        text: "Photo of a team offsite whiteboard with launch planning notes.",
      },
      availabilityHint: {
        kind: "partial",
        reason: "visualLimited",
      },
      actions: {
        canOpen: true,
        canReveal: true,
      },
    },
    searchTerms: [
      "team",
      "offsite",
      "photo",
      "whiteboard",
      "image",
      "planning",
    ],
  },
];

export const placeholderResults: readonly SearchResult[] =
  placeholderResultEntries.map(({ result }) => result);
