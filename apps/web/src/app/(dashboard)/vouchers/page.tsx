"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default function VouchersPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["vouchers", { search }],
    queryFn: () => ovx().vouchers.list({ search: search || undefined, limit: 25 }),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Vouchers</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Flat list across campaigns. Search by code.</T>
          </p>
        </div>
        <Button render={<Link href="/vouchers/new" />}>
          <Plus className="size-4" />
          <T>New voucher</T>
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={gt("Search by code")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <T>Code</T>
              </TableHead>
              <TableHead>
                <T>Type</T>
              </TableHead>
              <TableHead>
                <T>Discount</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Redemptions</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Active</T>
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
                  <T>No vouchers yet.</T>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link
                      className="font-mono text-sm hover:underline"
                      href={`/vouchers/${v.code}`}
                    >
                      {v.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.discount?.type === "AMOUNT"
                      ? `${String((v.discount.amount ?? 0) / 100)}`
                      : v.discount?.type === "PERCENTAGE"
                        ? `${String((v.discount.percent ?? 0) / 100)}%`
                        : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {v.redemptionCount}
                    {v.redemptionLimit ? ` / ${String(v.redemptionLimit)}` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={v.active ? "default" : "secondary"}>
                      {v.active ? gt("yes") : gt("no")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
