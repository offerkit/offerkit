import { withGTConfig } from "gt-next/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
  async redirects() {
    return [
      {
        source: "/docs/:path*",
        destination: "https://offerkit.dev/docs/:path*",
        permanent: true,
      },
      {
        source: "/MCP",
        destination: "/mcp",
        permanent: true,
      },
    ];
  },
};

// Runtime-only at launch: no GT cloud project / API key. Pass empty
// runtimeUrl + cacheUrl so I18nManager picks the "disabled" path
// instead of falling through to "custom" against the default GT URL,
// which logs projectId/apiKey-required warnings on every boot.
export default withGTConfig(nextConfig, {
  runtimeUrl: "",
  cacheUrl: "",
});
