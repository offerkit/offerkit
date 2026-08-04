"use client";

import { BookOpen } from "lucide-react";
import { T } from "gt-next/client";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function DashboardDocsLink({ href }: { href: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<a href={href} target="_blank" rel="noreferrer" />}
        tooltip={{ children: <T>Documentation</T> }}
      >
        <BookOpen className="size-4" />
        <span>
          <T>Documentation</T>
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
