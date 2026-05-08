import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Card>
        <CardHeader>
          <CardTitle>open-voucherify</CardTitle>
          <CardDescription>
            Welcome, {session.user.name}. The promotion engine surface ships in later phases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 1 is the foundation: auth, DB schema, worker, and observability are wired up.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
