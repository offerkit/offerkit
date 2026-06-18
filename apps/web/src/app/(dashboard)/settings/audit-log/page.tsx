"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
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
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "createdAt",
      header: () => <T>When</T>,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "actor",
      header: () => <T>Actor</T>,
      cell: ({ row }) => {
        const actor = row.original.actor as Exclude<Actor, "">;
        return <Badge variant={ACTOR_BADGE[actor]}>{actor}</Badge>;
      },
    },
    {
      accessorKey: "action",
      header: () => <T>Action</T>,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.action}</span>,
    },
    {
      accessorKey: "entity",
      header: () => <T>Entity</T>,
    },
    {
      accessorKey: "entityId",
      header: () => <T>Entity ID</T>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.entityId ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "ip",
      header: "IP",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.ip ?? "-"}</span>
      ),
    },
  ];

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

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={<T>No audit entries match the filters.</T>}
      />

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
