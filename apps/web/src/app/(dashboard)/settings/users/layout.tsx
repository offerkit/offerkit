import { redirect } from "next/navigation";
import { getDashboardRole, requireDashboardSession } from "@/lib/session";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const session = await requireDashboardSession();
  if (getDashboardRole(session) !== "admin") redirect("/dashboard");
  return children;
}
