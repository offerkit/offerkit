"use client";

import { useState } from "react";
import { T, useGT } from "gt-next/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ConditionType =
  | "order-total"
  | "product"
  | "collection"
  | "customer-segment"
  | "redemption-count"
  | "date-window"
  | "metadata-equals";

type ConditionOperator = "all" | "any";

interface BuilderCondition {
  id: string;
  type: ConditionType;
  value: string;
  value2?: string;
}

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
    label: "Total spent over 10000 minor units",
    rule: { ">": [{ var: "customer.summary.totalSpent" }, 10000] },
  },
];

const CONDITION_LABELS: Record<ConditionType, string> = {
  "order-total": "Order total above",
  product: "Order contains product",
  collection: "Order contains collection",
  "customer-segment": "Customer is in segment",
  "redemption-count": "Customer redemptions above",
  "date-window": "Current date is between",
  "metadata-equals": "Metadata field equals",
};

const DEFAULT_CONDITION: BuilderCondition = {
  id: "condition-1",
  type: "order-total",
  value: "5000",
  value2: "USD",
};

export interface RuleEditorProps {
  value: Record<string, unknown>;
  onChange: (rule: Record<string, unknown>) => void;
}

function conditionToRule(condition: BuilderCondition): Record<string, unknown> {
  switch (condition.type) {
    case "order-total":
      return {
        "order.total_above": [Number(condition.value || 0), condition.value2?.trim() || undefined],
      };
    case "product":
      return { "order.contains_product": [condition.value.trim()] };
    case "collection":
      return { "order.contains_collection": [condition.value.trim()] };
    case "customer-segment":
      return { "customer.in_segment": [condition.value.trim()] };
    case "redemption-count":
      return { "redemption.count_for_customer_above": [Number(condition.value || 0)] };
    case "date-window":
      return { "date.between": [condition.value.trim(), condition.value2?.trim() || condition.value.trim()] };
    case "metadata-equals":
      return { "==": [{ var: `metadata.${condition.value.trim()}` }, condition.value2 ?? ""] };
  }
}

function compileRule(
  operator: ConditionOperator,
  conditions: BuilderCondition[],
): Record<string, unknown> {
  const rules = conditions.map(conditionToRule);
  if (rules.length === 0) return { "==": [1, 1] };
  if (rules.length === 1) return rules[0] ?? { "==": [1, 1] };
  return { [operator === "all" ? "and" : "or"]: rules };
}

function valuePlaceholder(type: ConditionType) {
  switch (type) {
    case "order-total":
      return "5000";
    case "product":
      return "prod_123";
    case "collection":
      return "collection_123";
    case "customer-segment":
      return "seg_123";
    case "redemption-count":
      return "3";
    case "date-window":
      return "2026-01-01T00:00:00.000Z";
    case "metadata-equals":
      return "channel";
  }
}

function secondValuePlaceholder(type: ConditionType) {
  switch (type) {
    case "order-total":
      return "USD";
    case "date-window":
      return "2026-12-31T23:59:59.999Z";
    case "metadata-equals":
      return "vip";
    default:
      return undefined;
  }
}

function needsSecondValue(type: ConditionType) {
  return type === "order-total" || type === "date-window" || type === "metadata-equals";
}

export function RuleEditor({ value, onChange }: RuleEditorProps) {
  const gt = useGT();
  const serialized = JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [lastExternal, setLastExternal] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  const [operator, setOperator] = useState<ConditionOperator>("all");
  const [conditions, setConditions] = useState<BuilderCondition[]>([DEFAULT_CONDITION]);

  if (serialized !== lastExternal) {
    setLastExternal(serialized);
    setText(serialized);
    setError(null);
  }

  function applyRule(rule: Record<string, unknown>) {
    const next = JSON.stringify(rule, null, 2);
    setText(next);
    setLastExternal(next);
    setError(null);
    onChange(rule);
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

  function updateCondition(id: string, patch: Partial<BuilderCondition>) {
    const nextConditions = conditions.map((condition) => {
      if (condition.id !== id) return condition;
      const nextType = patch.type ?? condition.type;
      return {
        ...condition,
        ...patch,
        value: patch.type ? valuePlaceholder(nextType) : (patch.value ?? condition.value),
        value2: patch.type ? secondValuePlaceholder(nextType) : (patch.value2 ?? condition.value2),
      };
    });
    setConditions(nextConditions);
    applyRule(compileRule(operator, nextConditions));
  }

  function updateOperator(nextOperator: ConditionOperator) {
    setOperator(nextOperator);
    applyRule(compileRule(nextOperator, conditions));
  }

  function addCondition() {
    const nextConditions = [
      ...conditions,
      {
        ...DEFAULT_CONDITION,
        id: `condition-${Date.now()}`,
      },
    ];
    setConditions(nextConditions);
    applyRule(compileRule(operator, nextConditions));
  }

  function removeCondition(id: string) {
    const nextConditions = conditions.filter((condition) => condition.id !== id);
    setConditions(nextConditions);
    applyRule(compileRule(operator, nextConditions));
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">
            <T>Builder</T>
          </TabsTrigger>
          <TabsTrigger value="json">
            <T>Raw JSON</T>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label>
              <T>Match</T>
            </Label>
            <Select value={operator} onValueChange={(v) => updateOperator(v as ConditionOperator)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="any">any</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              <T>of these conditions.</T>
            </span>
          </div>

          <div className="space-y-3">
            {conditions.map((condition) => (
              <div key={condition.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[220px_1fr_1fr_auto]">
                <Select
                  items={(Object.keys(CONDITION_LABELS) as ConditionType[]).map((type) => ({
                    label: CONDITION_LABELS[type],
                    value: type,
                  }))}
                  value={condition.type}
                  onValueChange={(v) => updateCondition(condition.id, { type: v as ConditionType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONDITION_LABELS) as ConditionType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {CONDITION_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={condition.value}
                  onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                  placeholder={valuePlaceholder(condition.type)}
                />

                {needsSecondValue(condition.type) ? (
                  <Input
                    value={condition.value2 ?? ""}
                    onChange={(e) => updateCondition(condition.id, { value2: e.target.value })}
                    placeholder={secondValuePlaceholder(condition.type)}
                  />
                ) : (
                  <div className="hidden md:block" />
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeCondition(condition.id)}
                  disabled={conditions.length === 1}
                >
                  <T>Remove</T>
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addCondition}>
              <T>Add condition</T>
            </Button>
            <Button type="button" variant="secondary" onClick={() => applyRule(compileRule(operator, conditions))}>
              <T>Apply builder rule</T>
            </Button>
          </div>

          <div className="space-y-2">
            <Label>
              <T>Generated JSON Logic</T>
            </Label>
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(compileRule(operator, conditions), null, 2)}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="json" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="rule">
              <T>Rule (JSON Logic)</T>
            </Label>
            <div className="flex flex-wrap justify-end gap-2 text-xs">
              {SAMPLE_RULES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="rounded-md border px-2 py-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => applyRule(s.rule)}
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
            className="h-64 font-mono text-xs"
            spellCheck={false}
          />
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        <T>
          Build common order, product, collection, segment, date, redemption count, and metadata
          rules visually, or switch to raw JSON Logic for advanced rules. Segment rules can be
          previewed from the segment editor sidebar before saving.
        </T>
      </p>
    </div>
  );
}
