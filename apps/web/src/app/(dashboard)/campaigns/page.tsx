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

export default function CampaignsPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", { search }],
    queryFn: () => ovx().campaigns.list({ search: search || undefined, limit: 20 }),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Campaigns</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Discount, gift, loyalty, referral and promotion programs.</T>
          </p>
        </div>
        <Button render={<Link href="/campaigns/new" />}>
          <Plus className="size-4" />
          <T>New campaign</T>
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={gt("Search by name")}
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
                <T>Name</T>
              </TableHead>
              <TableHead>
                <T>Type</T>
              </TableHead>
              <TableHead>
                <T>Status</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Vouchers</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Updated</T>
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
                  <T>No campaigns yet.</T>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`/campaigns/${c.id}`}>
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.type}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {c.voucherCount}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleDateString()}
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
