"use client";

import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
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
        <div className="flex flex-col items-start text-left text-xs">
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-muted-foreground">{email}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={pending}>
          <LogOut className="size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
