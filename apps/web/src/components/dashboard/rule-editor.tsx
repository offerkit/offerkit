"use client";

import { useState } from "react";
import { T, useGT } from "gt-next/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SAMPLE_RULES = [
  {
    label: "Email contains @example.com",
    rule: { in: ["@example.com", { var: "customer.email" }] },
  },
  {
    label: "Has any phone number",
    rule: { "!=": [{ var: "customer.phone" }, null] },
  },
  {
    label: "Total spent over $100",
    rule: { ">": [{ var: "customer.summary.totalSpent" }, 10000] },
  },
];

export interface RuleEditorProps {
  value: Record<string, unknown>;
  onChange: (rule: Record<string, unknown>) => void;
}

export function RuleEditor({ value, onChange }: RuleEditorProps) {
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

  function applyText(next: string) {
    setText(next);
    try {
      const parsed = JSON.parse(next) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setError(gt("Rule must be a JSON object"));
        return;
      }
      setError(null);
      onChange(parsed as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : gt("Invalid JSON"));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="rule">
          <T>Rule (JSON Logic)</T>
        </Label>
        <div className="flex gap-2 text-xs">
          {SAMPLE_RULES.map((s) => (
            <button
              key={s.label}
              type="button"
              className="rounded-md border px-2 py-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => applyText(JSON.stringify(s.rule, null, 2))}
            >
              <T>{s.label}</T>
            </button>
          ))}
        </div>
      </div>
      <Textarea
        id="rule"
        value={text}
        onChange={(e) => applyText(e.target.value)}
        className="font-mono text-xs h-64"
        spellCheck={false}
      />
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        <T>
          Edit JSON Logic directly. A visual rule builder over JSON Logic is on the roadmap.
        </T>
      </p>
    </div>
  );
}
