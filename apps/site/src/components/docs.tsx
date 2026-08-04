import { navigate } from "astro:transitions/client";
import type { AstroProviderProps } from "fumadocs-core/framework/astro";
import type { Root } from "fumadocs-core/page-tree";
import type { DefaultSearchDialogProps } from "fumadocs-ui/components/dialog/search-default";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsPage, type DocsPageProps } from "fumadocs-ui/layouts/docs/page";
import { RootProvider } from "fumadocs-ui/provider/astro";
import type { ReactNode } from "react";
import SearchDialog from "./search";

export function Docs({
  tree,
  children,
  pathname,
  params,
  page,
  currentVersion,
  searchIndexUrl,
  versionOptions,
}: {
  tree: Root;
  children: ReactNode;
  pathname: string;
  params: AstroProviderProps["params"];
  page?: DocsPageProps;
  currentVersion: string;
  searchIndexUrl: string;
  versionOptions: Array<{ label: string; description: string; url: string }>;
}) {
  const VersionedSearchDialog = (props: DefaultSearchDialogProps) => (
    <SearchDialog {...props} indexUrl={searchIndexUrl} />
  );

  return (
    <RootProvider
      pathname={pathname}
      params={params}
      navigate={navigate}
      theme={{ enabled: false }}
      search={{ SearchDialog: VersionedSearchDialog }}
    >
      <DocsLayout
        tree={tree}
        githubUrl="https://github.com/offerkit/offerkit"
        themeSwitch={{ enabled: false }}
          nav={{
            title: (
              <span className="font-semibold tracking-tight">
                Offer<span className="text-fd-primary">Kit</span>
                <span className="ml-2 text-xs font-normal text-fd-muted-foreground">Docs</span>
              </span>
            ),
            url: "/docs",
          }}
        links={[
          {
            type: "menu",
            text: currentVersion,
            items: versionOptions.map((option) => ({
              text: option.label,
              description: option.description,
              url: option.url,
            })),
          },
          {
            text: "Website",
            url: "/",
          },
          {
            text: "Blog",
            url: "/blog",
          },
        ]}
      >
        <DocsPage {...page}>{children}</DocsPage>
      </DocsLayout>
    </RootProvider>
  );
}
