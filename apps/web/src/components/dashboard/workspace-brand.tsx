"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ovx } from "@/lib/sdk";

const DEFAULT_WORKSPACE_NAME = "offerkit";
const OFFERKIT_GITHUB_URL = "https://github.com/offerkit/offerkit";

export function workspaceInitial(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase() || "W";
}

export function DashboardWorkspaceBrand() {
  const { data } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => ovx().workspace.get({}),
  });
  const workspaceName = data?.name?.trim() || DEFAULT_WORKSPACE_NAME;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Avatar className="size-8 rounded-[0.65rem] bg-primary text-primary-foreground shadow-xs">
        <AvatarFallback className="rounded-[0.65rem] bg-primary text-xs font-semibold text-primary-foreground">
          {workspaceInitial(workspaceName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col leading-none group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-semibold">{workspaceName}</span>
        <Link
          href={OFFERKIT_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-1 w-fit text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          offerkit
        </Link>
      </div>
    </div>
  );
}
