"use client";

import { useGT } from "gt-next/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useJsonObjectDraft } from "./use-json-object-draft";

export interface JsonEditorProps {
  label: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  height?: string;
}

export function JsonEditor({ label, value, onChange, height = "h-48" }: JsonEditorProps) {
  const gt = useGT();
  const draft = useJsonObjectDraft({
    initialValue: value,
    onChange,
    invalidMessage: gt("Invalid JSON"),
    objectMessage: gt("Must be a JSON object"),
  });

  const id = `json-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={draft.text}
        onChange={(e) => draft.applyText(e.target.value)}
        className={`font-mono text-xs ${height}`}
        spellCheck={false}
      />
      {draft.error ? <p className="text-xs text-red-500">{draft.error}</p> : null}
    </div>
  );
}
