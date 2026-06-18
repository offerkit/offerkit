"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { Copy, Plus, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ovx } from "@/lib/sdk";

type Role = "admin" | "member";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const gt = useGT();
  const roleItems = [
    { label: gt("Member"), value: "member" },
    { label: gt("Admin"), value: "admin" },
  ];
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [generated, setGenerated] = useState<{ email: string; password: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => ovx().users.list({}),
  });

  const create = useMutation({
    mutationFn: () => ovx().users.create({ email, name, role }),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setGenerated({ email: user.email, password: user.password });
      setEmail("");
      setName("");
      setRole("member");
      toast.success(gt("User created — share the temporary password securely"));
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Create failed")),
  });

  const reset = useMutation({
    mutationFn: (id: string) => ovx().users.resetPassword({ params: { id } }),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setGenerated({ email: user.email, password: user.password });
      toast.success(gt("Password reset — share the new password securely"));
    },
  });

  const setRoleMut = useMutation({
    mutationFn: (vars: { id: string; role: Role }) =>
      ovx().users.setRole({ params: { id: vars.id }, body: { role: vars.role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const disable = useMutation({
    mutationFn: (id: string) => ovx().users.disable({ params: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const enable = useMutation({
    mutationFn: (id: string) => ovx().users.enable({ params: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "email",
      header: () => <T>Email</T>,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.email}</span>,
    },
    {
      accessorKey: "name",
      header: () => <T>Name</T>,
      cell: ({ row }) => row.original.name ?? "-",
    },
    {
      accessorKey: "role",
      header: () => <T>Role</T>,
      cell: ({ row }) => (
        <Select
          items={roleItems}
          value={row.original.role}
          onValueChange={(value) =>
            setRoleMut.mutate({ id: row.original.id, role: value as Role })
          }
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">{gt("Member")}</SelectItem>
            <SelectItem value="admin">{gt("Admin")}</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "status",
      header: () => <T>Status</T>,
      cell: ({ row }) =>
        row.original.disabledAt ? (
          <Badge variant="destructive">
            <T>Disabled</T>
          </Badge>
        ) : row.original.mustChangePassword ? (
          <Badge variant="secondary">
            <T>Must change password</T>
          </Badge>
        ) : (
          <Badge variant="outline">
            <T>Active</T>
          </Badge>
        ),
    },
    {
      id: "actions",
      header: () => <div className="text-right" />,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label={gt("Reset password")}>
                <RotateCcw className="size-4" />
              </Button>
            }
            title={gt("Reset password?")}
            description={gt("A new temporary password will be generated and shown once.")}
            confirmLabel={gt("Reset")}
            pending={reset.isPending}
            onConfirm={() => reset.mutate(row.original.id)}
          />
          {row.original.disabledAt ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={gt("Enable")}
              onClick={() => enable.mutate(row.original.id)}
            >
              <ShieldCheck className="size-4" />
            </Button>
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={gt("Disable")}>
                  <ShieldOff className="size-4" />
                </Button>
              }
              title={gt("Disable user?")}
              description={gt(
                "Active sessions will be revoked and the user will not be able to sign in.",
              )}
              confirmLabel={gt("Disable")}
              destructive
              pending={disable.isPending}
              onConfirm={() => disable.mutate(row.original.id)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Users</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Staff accounts that can sign in to this dashboard.</T>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Add user</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
          <div className="space-y-2">
            <Label htmlFor="user-email">
              <T>Email</T>
            </Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={gt("alex@company.com")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-name">
              <T>Name</T>
            </Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={gt("Optional")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">
              <T>Role</T>
            </Label>
            <Select items={roleItems} value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{gt("Member")}</SelectItem>
                <SelectItem value="admin">{gt("Admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="self-end"
            onClick={() => create.mutate()}
            disabled={create.isPending || !email.trim()}
          >
            <Plus className="size-4" />
            {create.isPending ? <T>Adding…</T> : <T>Add user</T>}
          </Button>
        </CardContent>
      </Card>

      {generated ? (
        <Card className="border-emerald-500/40">
          <CardHeader>
            <CardTitle>
              <T>Temporary password — copy now, it will not be shown again</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Input readOnly value={generated.email} className="max-w-xs" />
            <Input
              readOnly
              value={generated.password}
              className="font-mono text-sm"
              onFocus={(e) => e.target.select()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(generated.password);
                toast.success(gt("Copied"));
              }}
            >
              <Copy className="size-4" />
              <T>Copy</T>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setGenerated(null)}>
              <T>Dismiss</T>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Active users</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyMessage={<T>No users yet.</T>}
          />
        </CardContent>
      </Card>

    </div>
  );
}
