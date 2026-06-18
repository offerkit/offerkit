"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T } from "gt-next/client";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ovx } from "@/lib/sdk";

export default function InsightsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["insights"],
    queryFn: () => ovx().insights.summary({}),
    refetchInterval: 30_000,
  });
  const topCampaignColumns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "campaignName",
      header: () => <T>Campaign</T>,
    },
    {
      accessorKey: "redemptions",
      header: () => <div className="text-right"><T>Redemptions</T></div>,
      cell: ({ row }) => <div className="text-right font-mono">{row.original.redemptions}</div>,
    },
  ];
  const failureColumns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "reason",
      header: () => <T>Reason</T>,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.reason}</span>,
    },
    {
      accessorKey: "total",
      header: () => <div className="text-right"><T>Failures</T></div>,
      cell: ({ row }) => <div className="text-right font-mono">{row.original.total}</div>,
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Insights</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Headline metrics over the last 30 days. Auto-refreshes every 30 seconds.</T>
        </p>
      </header>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">
          <T>Loading…</T>
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KPI label="Redemptions today" value={data.counters.redemptionsToday} />
            <KPI label="Last 7 days" value={data.counters.redemptions7d} />
            <KPI label="Last 30 days" value={data.counters.redemptions30d} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <T>Redemptions per day (30d)</T>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DailyChart data={data.daily} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <T>Top campaigns</T>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={topCampaignColumns}
                  data={data.topCampaigns}
                  emptyMessage={<T>No data yet.</T>}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <T>Validation failure breakdown</T>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={failureColumns}
                  data={data.failures}
                  emptyMessage={<T>No failures recorded.</T>}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <T>Webhook delivery health</T>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.webhooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    <T>No deliveries yet.</T>
                  </p>
                ) : (
                  data.webhooks.map((w: DataTableRow) => (
                    <Badge
                      key={w.status}
                      variant={
                        w.status === "succeeded"
                          ? "default"
                          : w.status === "dead"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {w.status}: {w.total}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          <T>{label}</T>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DailyChart({ data }: { data: { day: string; total: number }[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        <T>No redemptions in the last 30 days.</T>
      </p>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.total));
  const width = 720;
  const height = 200;
  const barW = Math.max(4, Math.floor(width / data.length) - 2);
  return (
    <svg viewBox={`0 0 ${String(width)} ${String(height)}`} className="w-full h-48">
      {data.map((d, i) => {
        const h = Math.round((d.total / max) * (height - 24));
        return (
          <g key={d.day} transform={`translate(${String(i * (barW + 2))}, 0)`}>
            <rect
              y={height - h - 16}
              width={barW}
              height={h}
              className="fill-primary/80"
            />
            <title>
              {d.day}: {d.total}
            </title>
          </g>
        );
      })}
      <text x={0} y={height - 2} className="fill-muted-foreground text-[10px]">
        {data[0]?.day}
      </text>
      <text
        x={width}
        y={height - 2}
        textAnchor="end"
        className="fill-muted-foreground text-[10px]"
      >
        {data[data.length - 1]?.day}
      </text>
    </svg>
  );
}
