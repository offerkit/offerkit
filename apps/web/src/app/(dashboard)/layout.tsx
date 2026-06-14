import { headers } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import { T } from "gt-next";
import { auth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DashboardNav } from "@/components/dashboard/nav";
import { UserMenu } from "@/components/dashboard/user-menu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Image
              src="/icon.png"
              alt="OfferKit"
              width={32}
              height={32}
              unoptimized
              className="size-8 rounded-md"
              priority
            />
            <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold">Offerkit</span>
              <span className="text-xs text-muted-foreground">
                <T>Self-hosted</T>
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <DashboardNav
            role={(session.user as { role?: "admin" | "member" }).role ?? "member"}
          />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu name={session.user.name} email={session.user.email} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 h-4" />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
