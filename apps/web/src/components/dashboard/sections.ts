import type { ComponentType } from "react";
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

export interface DashboardSectionItem {
  href: string;
  // `label`, `section`, and `description` are stable English source strings; <T> wraps them at render.
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Render only for users with role=admin. */
  adminOnly?: boolean;
}

export interface DashboardSection {
  label: string;
  items: DashboardSectionItem[];
}

export const dashboardSections: DashboardSection[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        description: "Start from the main dashboard hub.",
        icon: Home,
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        href: "/customers",
        label: "Customers",
        description: "People who can redeem vouchers and earn loyalty points.",
        icon: Users,
      },
      {
        href: "/segments",
        label: "Segments",
        description: "Audience rules for targeting campaigns and offers.",
        icon: ListTree,
      },
    ],
  },
  {
    label: "Promotions",
    items: [
      {
        href: "/campaigns",
        label: "Campaigns",
        description: "Discount, gift, loyalty, referral and promotion programs.",
        icon: Megaphone,
      },
      {
        href: "/vouchers",
        label: "Vouchers",
        description: "Issued codes, balances, redemption tests, and status changes.",
        icon: TicketPercent,
      },
      {
        href: "/orders",
        label: "Orders",
        description: "Customer orders used for fulfillment and redemption context.",
        icon: ShoppingBag,
      },
      {
        href: "/insights",
        label: "Insights",
        description: "Redemption volume, top campaigns, and validation failures.",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Programs",
    items: [
      {
        href: "/loyalty",
        label: "Loyalty",
        description: "Points, tiers, member balances, and loyalty rewards.",
        icon: Coins,
      },
      {
        href: "/referrals",
        label: "Referrals",
        description: "Referral codes, conversions, and reward issuance.",
        icon: UserPlus,
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        href: "/rules",
        label: "Validation rules",
        description: "Reusable checks for voucher and promotion eligibility.",
        icon: ClipboardList,
      },
      {
        href: "/rewards",
        label: "Reward types",
        description: "Custom reward definitions attached to vouchers and programs.",
        icon: Gift,
      },
      {
        href: "/events",
        label: "Events",
        description: "Workspace event stream for customer and promotion activity.",
        icon: ScrollText,
      },
      {
        href: "/webhooks",
        label: "Webhooks",
        description: "Delivery endpoints and signing secrets for outbound events.",
        icon: Webhook,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/settings/api-keys",
        label: "API keys",
        description: "Scoped API credentials for server integrations.",
        icon: Key,
      },
      {
        href: "/settings/audit-log",
        label: "Audit log",
        description: "Admin-only mutation history across dashboard and API actions.",
        icon: FileText,
        adminOnly: true,
      },
      {
        href: "/settings/users",
        label: "Users",
        description: "Admin-only staff accounts and role management.",
        icon: Boxes,
        adminOnly: true,
      },
      {
        href: "/settings",
        label: "Workspace",
        description: "Workspace profile, currency, and operational defaults.",
        icon: Settings,
      },
    ],
  },
];
