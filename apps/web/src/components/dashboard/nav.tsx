"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, comingPhase: 3 },
      { href: "/vouchers", label: "Vouchers", icon: TicketPercent, comingPhase: 3 },
      { href: "/orders", label: "Orders", icon: ShoppingBag, comingPhase: 3 },
      { href: "/insights", label: "Insights", icon: BarChart3, comingPhase: 10 },
    ],
  },
  {
    label: "Programs",
    items: [
      { href: "/loyalty", label: "Loyalty", icon: Coins, comingPhase: 5 },
      { href: "/referrals", label: "Referrals", icon: UserPlus, comingPhase: 6 },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/rules", label: "Validation rules", icon: ClipboardList, comingPhase: 3 },
      { href: "/rewards", label: "Reward types", icon: Gift, comingPhase: 5 },
      { href: "/events", label: "Events", icon: ScrollText, comingPhase: 9 },
      { href: "/webhooks", label: "Webhooks", icon: Webhook, comingPhase: 9 },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/api-keys", label: "API keys", icon: Key, comingPhase: 8 },
      { href: "/settings/audit-log", label: "Audit log", icon: FileText, comingPhase: 9 },
      { href: "/settings/users", label: "Users", icon: Boxes, comingPhase: 8 },
      { href: "/settings", label: "Workspace", icon: Settings, comingPhase: 8 },
    ],
  },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
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
                        disabled ? `Available in Phase ${String(item.comingPhase)}` : undefined
                      }
                      className={disabled ? "pointer-events-none opacity-50" : undefined}
                      render={disabled ? <span /> : <Link href={item.href} />}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
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
