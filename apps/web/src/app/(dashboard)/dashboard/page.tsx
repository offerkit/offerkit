import Link from "next/link";
import { getMessages } from "gt-next/server";
import { getDashboardRole, requireDashboardSession } from "@/lib/session";
import { dashboardSections } from "@/components/dashboard/sections";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const role = getDashboardRole(await requireDashboardSession());
  const m = await getMessages();
  const sections = dashboardSections
    .filter((section) => !section.items.some((item) => item.href === "/dashboard"))
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
            {m(section.label)}
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
                        {m(item.label)}
                      </CardTitle>
                      <CardDescription>
                        {m(item.description)}
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
