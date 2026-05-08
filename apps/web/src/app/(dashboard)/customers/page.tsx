"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
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

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["customers", { search, cursor }],
    queryFn: () => ovx().customers.list({ search: search || undefined, cursor, limit: 20 }),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            People who can redeem vouchers and earn loyalty points.
          </p>
        </div>
        <Button render={<Link href="/customers/new" />}>
          <Plus className="size-4" />
          New customer
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by email or name"
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCursor(undefined);
          }}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  {search ? "No customers match your search." : "No customers yet."}
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`/customers/${c.id}`}>
                      {c.email ?? "(no email)"}
                    </Link>
                  </TableCell>
                  <TableCell>{c.name ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data?.next ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => setCursor(data.next)}
          >
            Next page
          </Button>
        </div>
      ) : null}
    </div>
  );
}
