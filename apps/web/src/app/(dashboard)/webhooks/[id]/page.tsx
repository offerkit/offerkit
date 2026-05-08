"use client";

import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function WebhookDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const gt = useGT();

  const { data: webhook } = useQuery({
    queryKey: ["webhooks", id],
    queryFn: () => ovx().webhooks.get({ id }),
  });

  const { data: deliveries } = useQuery({
    queryKey: ["webhooks", id, "deliveries"],
    queryFn: () => ovx().webhooks.deliveries({ id, limit: 50 }),
    refetchInterval: 5_000,
  });

  const replay = useMutation({
    mutationFn: (deliveryId: string) => ovx().webhooks.replay({ id: deliveryId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["webhooks", id, "deliveries"] });
      toast.success(gt("Re-enqueued"));
    },
  });

  if (!webhook)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href="/webhooks" aria-label={gt("Back")} />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{webhook.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{webhook.url}</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Recent deliveries</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T>Event</T>
                </TableHead>
                <TableHead>
                  <T>Status</T>
                </TableHead>
                <TableHead className="text-right">
                  <T>Attempts</T>
                </TableHead>
                <TableHead>
                  <T>Response</T>
                </TableHead>
                <TableHead>
                  <T>Created</T>
                </TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!deliveries || deliveries.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    <T>No deliveries yet.</T>
                  </TableCell>
                </TableRow>
              ) : (
                deliveries.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.eventType}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.status === "succeeded"
                            ? "default"
                            : d.status === "dead"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {d.attempts}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.responseStatus
                        ? `HTTP ${String(d.responseStatus)}`
                        : (d.error ?? "—")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(d.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => replay.mutate(d.id)}
                        aria-label={gt("Replay")}
                        disabled={replay.isPending}
                      >
                        <RotateCw className="size-4" />
                      </Button>
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
