"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ovx } from "@/lib/sdk";

type Actor = "" | "user" | "api_key" | "system";

const ACTOR_BADGE: Record<Exclude<Actor, "">, "default" | "secondary" | "outline"> = {
  user: "default",
  api_key: "secondary",
  system: "outline",
};

export default function AuditLogPage() {
  const gt = useGT();
  const [actor, setActor] = useState<Actor>("");
  const [entity, setEntity] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["auditLog", { actor, entity, cursor }],
    queryFn: () =>
      ovx().auditLog.list({
        actor: actor || undefined,
        entity: entity.trim() || undefined,
        cursor,
        limit: 50,
      }),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Audit log</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Every mutation through the API and dashboard, in reverse-chronological order.</T>
        </p>
      </header>

      <div className="flex items-center gap-2">
        <Select
          items={[
            { label: gt("All actors"), value: "" },
            { label: gt("Users"), value: "user" },
            { label: gt("API keys"), value: "api_key" },
            { label: gt("System"), value: "system" },
          ]}
          value={actor}
          onValueChange={(v) => {
            setActor(v as Actor);
            setCursor(undefined);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={gt("All actors")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{gt("All actors")}</SelectItem>
            <SelectItem value="user">{gt("Users")}</SelectItem>
            <SelectItem value="api_key">{gt("API keys")}</SelectItem>
            <SelectItem value="system">{gt("System")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder={gt("Filter by entity (e.g. campaigns)")}
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setCursor(undefined);
          }}
          className="max-w-xs"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <T>When</T>
              </TableHead>
              <TableHead>
                <T>Actor</T>
              </TableHead>
              <TableHead>
                <T>Action</T>
              </TableHead>
              <TableHead>
                <T>Entity</T>
              </TableHead>
              <TableHead>
                <T>Entity ID</T>
              </TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  <T>Loading…</T>
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  <T>No audit entries match the filters.</T>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTOR_BADGE[row.actor]}>{row.actor}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell>{row.entity}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.entityId ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.ip ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data?.next ? (
        <div className="flex justify-end">
          <Button variant="outline" disabled={isFetching} onClick={() => setCursor(data.next)}>
            <T>Next page</T>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
