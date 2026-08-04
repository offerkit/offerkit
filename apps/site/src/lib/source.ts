import path from "node:path";
import { getCollection, type CollectionEntry } from "astro:content";
import { structure, type StructuredData } from "fumadocs-core/mdx-plugins";
import { loader, type StaticSource } from "fumadocs-core/source";
import versionManifest from "../../versions.json";

type DocsEntry = CollectionEntry<"docs">;
type MetaEntry = CollectionEntry<"meta">;

interface VersionManifest {
  latest: string;
  versions: string[];
}

const manifest = versionManifest as VersionManifest;
if (!manifest.versions.includes(manifest.latest)) {
  throw new Error(`versions.json must include the latest version (${manifest.latest})`);
}

const pages = await getCollection("docs");
const metadata = await getCollection("meta");

function createSource(contentDirectory: string, baseUrl: string) {
  return loader({
    source: createStaticSource(contentDirectory),
    baseUrl,
    plugins: [
      {
        name: "canonical-page-urls",
        config(config) {
          config.url = (slugs) => pageUrl(baseUrl, slugs);
        },
      },
    ],
  });
}

function pageUrl(baseUrl: string, slugs: string[]) {
  return `${[baseUrl, ...slugs].filter(Boolean).join("/").replaceAll("//", "/")}/`;
}

function createStaticSource(contentDirectory: string) {
  const output: StaticSource<{
    metaData: MetaEntry["data"];
    pageData: DocsEntry["data"] & { _raw: DocsEntry };
  }> = { files: [] };
  const contentRoot = path.join("content", contentDirectory);

  for (const page of pages) {
    const virtualPath = relativeEntryPath(contentRoot, page.filePath);
    if (!virtualPath) continue;
    output.files.push({
      type: "page",
      path: virtualPath,
      data: { ...page.data, _raw: page },
    });
  }

  for (const meta of metadata) {
    const virtualPath = relativeEntryPath(contentRoot, meta.filePath);
    if (!virtualPath) continue;
    output.files.push({
      type: "meta",
      path: virtualPath,
      data: meta.data,
    });
  }

  return output;
}

function relativeEntryPath(contentRoot: string, filePath: string | undefined) {
  if (!filePath) return undefined;
  const relative = path.relative(contentRoot, filePath);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }
  return relative;
}

const stableSource = createSource("docs", "/docs");
const nextSource = createSource("next", "/docs/next");

export type DocsSource = typeof stableSource;
export type DocsVariantKind = "stable" | "next" | "archive";

export interface DocsVariant {
  id: string;
  kind: DocsVariantKind;
  label: string;
  version: string;
  baseUrl: string;
  searchIndexUrl: string;
  source: DocsSource;
}

const archivedVariants: DocsVariant[] = manifest.versions.map((version) => ({
  id: `version:${version}`,
  kind: "archive",
  label: `v${version}`,
  version,
  baseUrl: `/docs/v/${version}`,
    searchIndexUrl: `/docs/v/${version}/api/search/`,
  source: createSource(`versions/${version}`, `/docs/v/${version}`),
}));

export const latestVersion = manifest.latest;

export const docsVariants: DocsVariant[] = [
  {
    id: "stable",
    kind: "stable",
    label: `v${manifest.latest}`,
    version: manifest.latest,
    baseUrl: "/docs",
    searchIndexUrl: "/docs/api/search",
    source: stableSource,
  },
  {
    id: "next",
    kind: "next",
    label: "Next",
    version: "next",
    baseUrl: "/docs/next",
    searchIndexUrl: "/docs/next/api/search",
    source: nextSource,
  },
  ...archivedVariants,
];

export const source = stableSource;

export function getDocsVariant(id: string) {
  const variant = docsVariants.find((candidate) => candidate.id === id);
  if (!variant) throw new Error(`Unknown docs variant: ${id}`);
  return variant;
}

export function getArchivedVariants() {
  return archivedVariants;
}

export function getVersionOptions(slugs: string[]) {
  const selectable = [
    getDocsVariant("stable"),
    getDocsVariant("next"),
    ...archivedVariants.filter((variant) => variant.version !== latestVersion),
  ];

  return selectable.map((variant) => ({
    label: variant.kind === "stable" ? `${variant.label} (latest)` : variant.label,
    description:
      variant.kind === "stable"
        ? "Latest stable release"
        : variant.kind === "next"
          ? "Unreleased documentation"
          : "Previous release",
    url: variant.source.getPage(slugs)?.url ?? `${variant.baseUrl}/`,
  }));
}

export function getStructuredData(entry: DocsEntry): StructuredData {
  return structure(entry.body ?? "");
}
