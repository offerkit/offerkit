import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import {
  rehypeCode,
  remarkCodeTab,
  remarkHeading,
  remarkNpm,
  remarkStructure,
} from "fumadocs-core/mdx-plugins";
import { defineConfig } from "astro/config";
import { remarkVersionedLinks } from "./src/lib/remark-versioned-links.mjs";

const remarkPlugins = [
  remarkHeading,
  remarkCodeTab,
  remarkNpm,
  remarkVersionedLinks,
  [remarkStructure, { exportAs: "structuredData" }],
];

export default defineConfig({
  site: "https://offerkit.dev",
  output: "static",
  trailingSlash: "always",
  markdown: {
    processor: unified({
      syntaxHighlight: false,
      remarkPlugins,
      rehypePlugins: [rehypeCode],
    }),
  },
  integrations: [
    react(),
    sitemap({
      filter(page) {
        const pathname = new URL(page).pathname;
        return (
          !pathname.startsWith("/docs/next/") &&
          !pathname.startsWith("/docs/v/") &&
          pathname !== "/docs/integrations/" &&
          pathname !== "/docs/webhooks/"
        );
      },
    }),
    mdx({
      extendMarkdownConfig: true,
      syntaxHighlight: false,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
