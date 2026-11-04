"use client";

import { Languages, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { T, useLocale } from "gt-next/client";
import { authClient } from "@/lib/auth-client";
import { DASHBOARD_LOCALES, isDashboardLocale, localeCookie } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const locale = useLocale();
  function changeLocale(next: string) {
    if (!isDashboardLocale(next) || next === locale) return;
    // Persist the choice for a year; gt-next prefers this cookie over
    // Accept-Language, and the refresh re-renders server components in it.
    document.cookie = localeCookie(next);
    router.refresh();
  }
  function signOut() {
    start(async () => {
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" />}
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
          <User className="size-4 text-primary" />
        </div>
        <div className="flex flex-col items-start text-left text-xs group-data-[collapsible=icon]:hidden">
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-muted-foreground">{email}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Languages className="size-3.5" />
            <T>Language</T>
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
            {DASHBOARD_LOCALES.map((option) => (
              <DropdownMenuRadioItem key={option.code} value={option.code} lang={option.code}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={pending}>
          <LogOut className="size-4" />
          <span>
            <T>Sign out</T>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
