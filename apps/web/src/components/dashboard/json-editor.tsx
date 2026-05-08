"use client";

import { useState } from "react";
import { useGT } from "gt-next/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface JsonEditorProps {
  label: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  height?: string;
}

export function JsonEditor({ label, value, onChange, height = "h-48" }: JsonEditorProps) {
  const gt = useGT();
  const serialized = JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [lastExternal, setLastExternal] = useState(serialized);
  const [error, setError] = useState<string | null>(null);

  if (serialized !== lastExternal) {
    setLastExternal(serialized);
    setText(serialized);
    setError(null);
  }

  function apply(next: string) {
    setText(next);
    try {
      const parsed = JSON.parse(next) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setError(gt("Must be a JSON object"));
        return;
      }
      setError(null);
      onChange(parsed as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : gt("Invalid JSON"));
    }
  }

  const id = `json-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={text}
        onChange={(e) => apply(e.target.value)}
        className={`font-mono text-xs ${height}`}
        spellCheck={false}
      />
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
