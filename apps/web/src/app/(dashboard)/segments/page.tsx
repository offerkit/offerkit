"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
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

export default function SegmentsPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["segments", { search }],
    queryFn: () => ovx().segments.list({ search: search || undefined, limit: 20 }),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Segments</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Reusable JSON Logic rules over customer attributes.</T>
          </p>
        </div>
        <Button render={<Link href="/segments/new" />}>
          <Plus className="size-4" />
          <T>New segment</T>
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
                <T>Description</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Updated</T>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  <T>Loading…</T>
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  <T>No segments yet.</T>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`/segments/${s.id}`}>
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.description ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(s.updatedAt).toLocaleDateString()}
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
