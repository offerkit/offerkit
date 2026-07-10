"use client";

import { useReducer } from "react";

export type CursorHistory = readonly (string | undefined)[];

export type CursorAction =
  | { type: "next"; cursor: string }
  | { type: "previous" }
  | { type: "reset" };

export function cursorHistoryReducer(
  history: CursorHistory,
  action: CursorAction,
): CursorHistory {
  switch (action.type) {
    case "next":
      return [...history, action.cursor];
    case "previous":
      return history.length > 1 ? history.slice(0, -1) : history;
    case "reset":
      return [undefined];
  }
}

export function useCursorPagination() {
  const [history, dispatch] = useReducer(cursorHistoryReducer, [undefined]);
  return {
    cursor: history[history.length - 1],
    canPrevious: history.length > 1,
    next: (cursor: string) => dispatch({ type: "next", cursor }),
    previous: () => dispatch({ type: "previous" }),
    reset: () => dispatch({ type: "reset" }),
  };
}
