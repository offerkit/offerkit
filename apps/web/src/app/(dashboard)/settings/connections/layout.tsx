import { notFound } from "next/navigation";
import { isHostedMcpEnabled } from "@/lib/hosted-mcp";

export default function AgentConnectionsLayout({ children }: { children: React.ReactNode }) {
  if (!isHostedMcpEnabled()) notFound();
  return children;
}
