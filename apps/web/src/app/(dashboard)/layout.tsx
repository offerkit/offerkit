import { redirect } from "next/navigation";
import {
  getDashboardRole,
  requireDashboardSession,
  userMustChangePassword,
} from "@/lib/session";
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
import { DashboardWorkspaceBrand } from "@/components/dashboard/workspace-brand";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireDashboardSession();
  if (userMustChangePassword(session)) redirect("/change-password");

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <DashboardWorkspaceBrand />
        </SidebarHeader>
        <SidebarContent>
          <DashboardNav role={getDashboardRole(session)} />
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
