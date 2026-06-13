import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { T } from "gt-next";
import { auth } from "@/lib/auth";
import { dashboardSections } from "@/components/dashboard/sections";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const role = (session.user as { role?: "admin" | "member" }).role ?? "member";
  const sections = dashboardSections
    .filter((section) => section.label !== "Overview")
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || role === "admin"),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.label} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            <T>{section.label}</T>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="block">
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <T>{item.label}</T>
                      </CardTitle>
                      <CardDescription>
                        <T>{item.description}</T>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
