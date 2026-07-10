"use client";

import { useState } from "react";

export type JsonObjectParseResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "not-object" };

export function parseJsonObject(text: string): JsonObjectParseResult {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, reason: "not-object" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false,
      reason: "invalid",
      message: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export function useJsonObjectDraft({
  initialValue,
  onChange,
  invalidMessage,
  objectMessage,
}: {
  initialValue: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  invalidMessage: string;
  objectMessage: string;
}) {
  const [text, setText] = useState(() => JSON.stringify(initialValue, null, 2));
  const [error, setError] = useState<string | null>(null);

  function applyText(next: string) {
    setText(next);
    const result = parseJsonObject(next);
    if (!result.ok) {
      setError(result.reason === "not-object" ? objectMessage : result.message || invalidMessage);
      return;
    }
    setError(null);
    onChange(result.value);
  }

  function replace(value: Record<string, unknown>) {
    setText(JSON.stringify(value, null, 2));
    setError(null);
    onChange(value);
  }

  return { text, error, applyText, replace };
}
