import { describe, expect, it } from "vitest";
import { cursorHistoryReducer } from "./use-cursor-pagination";

describe("cursorHistoryReducer", () => {
  it("tracks forward cursors and restores the previous page", () => {
    const secondPage = cursorHistoryReducer([undefined], { type: "next", cursor: "cursor-2" });
    const thirdPage = cursorHistoryReducer(secondPage, { type: "next", cursor: "cursor-3" });

    expect(thirdPage).toEqual([undefined, "cursor-2", "cursor-3"]);
    expect(cursorHistoryReducer(thirdPage, { type: "previous" })).toEqual([
      undefined,
      "cursor-2",
    ]);
  });

  it("does not move before the first page and resets when filters change", () => {
    expect(cursorHistoryReducer([undefined], { type: "previous" })).toEqual([undefined]);
    expect(cursorHistoryReducer([undefined, "cursor-2"], { type: "reset" })).toEqual([
      undefined,
    ]);
  });
});
