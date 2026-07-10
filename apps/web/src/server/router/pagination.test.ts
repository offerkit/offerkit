import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./pagination";

describe("pagination cursors", () => {
  it("round-trips a cursor as opaque base64url", () => {
    const cursor = {
      createdAt: "2026-07-10T10:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000001",
    };

    const encoded = encodeCursor(cursor);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("rejects missing, malformed, and incorrectly shaped cursors", () => {
    const wrongShape = Buffer.from(JSON.stringify({ createdAt: 123, id: null })).toString(
      "base64url",
    );

    expect(decodeCursor(undefined)).toBeUndefined();
    expect(decodeCursor("not-json")).toBeUndefined();
    expect(decodeCursor(wrongShape)).toBeUndefined();
  });
});
