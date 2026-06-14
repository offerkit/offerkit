import { requireDashboardSession } from "@/lib/session";

export default async function ChangePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDashboardSession();
  return children;
}
