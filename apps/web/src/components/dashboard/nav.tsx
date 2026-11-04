"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "gt-next/client";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { dashboardSections } from "@/components/dashboard/sections";

export function DashboardNav({
  role,
  hostedMcpEnabled,
}: {
  role: "admin" | "member";
  hostedMcpEnabled: boolean;
}) {
  const pathname = usePathname();
  const m = useMessages();
  return (
    <>
      {dashboardSections.map((section) => {
        const items = section.items.filter(
          (it) =>
            (!it.adminOnly || role === "admin") &&
            (!it.requiresHostedMcp || hostedMcpEnabled),
        );
        if (items.length === 0) return null;
        return (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>
              {m(section.label)}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        render={<Link href={item.href} />}
                        tooltip={{ children: m(item.label) }}
                      >
                        <Icon className="size-4" />
                        <span>
                          {m(item.label)}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}
