import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type DashboardRole = "admin" | "member";

export const getDashboardSession = cache(async () =>
  auth().api.getSession({ headers: await headers() }),
);

export async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/sign-in");
  return session;
}

export function getDashboardRole(session: Awaited<ReturnType<typeof getDashboardSession>>) {
  return (session?.user as { role?: DashboardRole } | undefined)?.role ?? "member";
}

export function userMustChangePassword(
  session: Awaited<ReturnType<typeof getDashboardSession>>,
) {
  return (
    (session?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword === true
  );
}
