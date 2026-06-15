"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Search } from "lucide-react";
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

type Status = "" | "CREATED" | "PAID" | "CANCELED" | "FULFILLED";

const STATUS_BADGE: Record<Exclude<Status, "">, "default" | "secondary" | "destructive" | "outline"> = {
  CREATED: "secondary",
  PAID: "default",
  FULFILLED: "default",
  CANCELED: "destructive",
};

function formatCents(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

export default function OrdersPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["orders", { search, status, cursor }],
    queryFn: () =>
      ovx().orders.list({
        search: search || undefined,
        status: status || undefined,
        cursor,
        limit: 20,
      }),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Orders</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Orders that touched a redemption — useful for support and refund workflows.</T>
        </p>
      </header>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={gt("Search by external ID")}
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(undefined);
            }}
          />
        </div>
        <Select
          items={[
            { label: gt("All statuses"), value: "" },
            { label: gt("Created"), value: "CREATED" },
            { label: gt("Paid"), value: "PAID" },
            { label: gt("Fulfilled"), value: "FULFILLED" },
            { label: gt("Canceled"), value: "CANCELED" },
          ]}
          value={status}
          onValueChange={(v) => {
            setStatus(v as Status);
            setCursor(undefined);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={gt("All statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{gt("All statuses")}</SelectItem>
            <SelectItem value="CREATED">{gt("Created")}</SelectItem>
            <SelectItem value="PAID">{gt("Paid")}</SelectItem>
            <SelectItem value="FULFILLED">{gt("Fulfilled")}</SelectItem>
            <SelectItem value="CANCELED">{gt("Canceled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <T>External ID</T>
              </TableHead>
              <TableHead>
                <T>Status</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Amount</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Discount</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Created</T>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  <T>Loading…</T>
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  <T>No orders yet.</T>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`/orders/${o.id}`}>
                      {o.externalId ?? o.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[o.status]}>{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCents(o.amount, o.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {o.discountAmount > 0 ? formatCents(o.discountAmount, o.currency) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString()}
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
