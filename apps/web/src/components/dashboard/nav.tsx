"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "gt-next/client";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { dashboardSections } from "@/components/dashboard/sections";

export function DashboardNav({ role }: { role: "admin" | "member" }) {
  const pathname = usePathname();
  return (
    <>
      {dashboardSections.map((section) => {
        const items = section.items.filter((it) => !it.adminOnly || role === "admin");
        if (items.length === 0) return null;
        return (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>
              <T>{section.label}</T>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton isActive={active} render={<Link href={item.href} />}>
                        <Icon className="size-4" />
                        <span>
                          <T>{item.label}</T>
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
