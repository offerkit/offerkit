"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ovx } from "@/lib/sdk";
import { RuleEditor } from "./rule-editor";

export interface SegmentFormState {
  name: string;
  description: string;
  rule: Record<string, unknown>;
}

export function SegmentForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
}: {
  initial: SegmentFormState;
  submitLabel: string;
  onSubmit: (state: SegmentFormState) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [rule, setRule] = useState<Record<string, unknown>>(initial.rule);

  const preview = useMutation({
    mutationFn: () => ovx().segments.preview({ rule, sampleSize: 10 }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, description, rule });
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="VIP customers"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional context for this segment"
                className="h-20"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rule</CardTitle>
            <CardDescription>
              Customer-attribute rules in JSON Logic. Order/redemption operators land in Phase 3.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RuleEditor value={rule} onChange={setRule} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>

      <Card className="self-start">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-4" />
            Preview
          </CardTitle>
          <CardDescription>Run the rule against existing customers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => preview.mutate()}
            disabled={preview.isPending}
          >
            {preview.isPending ? "Running…" : "Run preview"}
          </Button>

          {preview.data ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{preview.data.matchedCount}</Badge>
                <span className="text-muted-foreground">customers match</span>
              </div>
              <ul className="divide-y rounded-md border text-sm">
                {preview.data.sample.length === 0 ? (
                  <li className="px-3 py-2 text-muted-foreground">No sample matches.</li>
                ) : (
                  preview.data.sample.map((c) => (
                    <li key={c.id} className="px-3 py-2">
                      <div className="font-medium">{c.email ?? "(no email)"}</div>
                      <div className="text-xs text-muted-foreground">{c.name ?? "—"}</div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          {preview.error ? (
            <p className="text-xs text-red-500">
              {preview.error instanceof Error ? preview.error.message : "Preview failed"}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
