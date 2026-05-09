"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T, useGT } from "gt-next/client";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Coins,
  FileText,
  Gift,
  Home,
  Key,
  ListTree,
  Megaphone,
  ScrollText,
  Settings,
  ShoppingBag,
  TicketPercent,
  UserPlus,
  Users,
  Webhook,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavItem {
  href: string;
  // `label` and `groupLabel` are stable English source strings; <T> wraps them at render.
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  comingPhase?: number;
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Overview", icon: Home }],
  },
  {
    label: "People",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/segments", label: "Segments", icon: ListTree },
    ],
  },
  {
    label: "Promotions",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/vouchers", label: "Vouchers", icon: TicketPercent },
      { href: "/orders", label: "Orders", icon: ShoppingBag },
      { href: "/insights", label: "Insights", icon: BarChart3 },
    ],
  },
  {
    label: "Programs",
    items: [
      { href: "/loyalty", label: "Loyalty", icon: Coins },
      { href: "/referrals", label: "Referrals", icon: UserPlus },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/rules", label: "Validation rules", icon: ClipboardList },
      { href: "/rewards", label: "Reward types", icon: Gift },
      { href: "/events", label: "Events", icon: ScrollText },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/api-keys", label: "API keys", icon: Key },
      { href: "/settings/audit-log", label: "Audit log", icon: FileText },
      { href: "/settings/users", label: "Users", icon: Boxes },
      { href: "/settings", label: "Workspace", icon: Settings, comingPhase: 8 },
    ],
  },
];

export function DashboardNav() {
  const pathname = usePathname();
  const gt = useGT();
  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label}>
          <SidebarGroupLabel>
            <T>{section.label}</T>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const disabled = item.comingPhase != null;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={
                        disabled
                          ? gt("Available in Phase {phase}").replace(
                              "{phase}",
                              String(item.comingPhase),
                            )
                          : undefined
                      }
                      className={disabled ? "pointer-events-none opacity-50" : undefined}
                      render={disabled ? <span /> : <Link href={item.href} />}
                    >
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
      ))}
    </>
  );
}
