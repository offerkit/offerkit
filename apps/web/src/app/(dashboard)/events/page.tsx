"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ovx } from "@/lib/sdk";

export default function EventsPage() {
  const gt = useGT();
  const [type, setType] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["events", { type }],
    queryFn: () =>
      ovx().events.list({ limit: 50, ...(type ? { type } : {}) }),
    refetchInterval: 5_000,
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Events</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Append-only log of domain events emitted by the system.</T>
        </p>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={gt("Filter by exact type, e.g. voucher.redeemed")}
          className="pl-9 font-mono text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T>Type</T>
                </TableHead>
                <TableHead>
                  <T>Entity</T>
                </TableHead>
                <TableHead>
                  <T>Payload</T>
                </TableHead>
                <TableHead className="text-right">
                  <T>Created</T>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    <T>Loading…</T>
                  </TableCell>
                </TableRow>
              ) : !data || data.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    <T>No events yet.</T>
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {e.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {e.entityId ? `${e.entityId.slice(0, 8)}…` : "—"}
                    </TableCell>
                    <TableCell>
                      <pre className="overflow-auto rounded-md border bg-muted/40 p-2 text-xs max-w-prose">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
