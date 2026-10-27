import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const origin = "https://offerkit.dev";
const failures = [];
const pages = new Map();
const redirects = new Map((await readFile(path.join(dist, "_redirects"), "utf8"))
  .split("\n").filter((line) => line.trim() && !line.startsWith("#"))
  .map((line) => line.trim().split(/\s+/).slice(0, 2)));

// Astro emits quoted attributes. Decode references before comparing text and URLs.
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => [match[1], decode(match[2] ?? match[3])]));
}

function decode(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[entity] ?? match;
  });
}

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(filename);
    else if (entry.name === "search") {
      const data = JSON.parse(await readFile(filename, "utf8"));
      const inspect = (node) => {
        if (!node || typeof node !== "object") return;
        if (typeof node.url === "string" && redirects.has(node.url.split(/[?#]/)[0])) {
          failures.push(`${path.relative(dist, filename)}: search result points to redirect ${node.url}`);
        }
        Object.values(node).forEach(inspect);
      };
      inspect(data);
    }
    else if (entry.name.endsWith(".html")) {
      const url = `/${path.relative(dist, filename).split(path.sep).join("/")}`.replace(/index\.html$/, "");
      if (redirects.has(url)) continue;
      const html = await readFile(filename, "utf8");
      pages.set(url, { html, incoming: new Set(), indexableIncoming: new Set(), noIndex: /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html) });
    }
  }
}

await visit(dist);
assert.ok(pages.size > 0, "Build the site before running check:seo");
for (const [url, page] of pages) {
  const head = page.html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)?.[1] ?? "";
  const meta = [...head.matchAll(/<meta\b[^>]*>/g)].map((match) => attributes(match[0]));
  const description = meta.find((item) => item.name === "description")?.content ?? "";
  const canonical = [...head.matchAll(/<link\b[^>]*>/g)].map((match) => attributes(match[0]))
    .filter((item) => item.rel === "canonical");
  const check = (condition, message) => { if (!condition) failures.push(`${url}: ${message}`); };
  check(description.length >= 120 && description.length <= 165, `description has ${description.length} characters (expected 120–165)`);
  check(page.noIndex ? canonical.length === 0 : canonical.length === 1 && canonical[0].href === `${origin}${url}`, "indexable pages must have matching HTTPS canonicals; noindex pages should omit them");
  const versioned = /^\/docs\/(next|v)(\/|$)/.test(url);
  if (versioned) check(meta.some((item) => item.name === "robots" && item.content.includes("noindex")), "versioned docs must remain noindex");
  const scripts = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((match) => attributes(match[1]).type === "application/ld+json");
  let graph = [];
  try {
    check(scripts.length === 1, "expected one structured-data graph in the head");
    const data = JSON.parse(scripts[0]?.[2] ?? "null");
    check(data?.["@context"] === "https://schema.org", "missing Schema.org context");
    graph = data?.["@graph"] ?? [];
  } catch { check(false, "invalid JSON-LD"); }
  const types = (node) => [node["@type"]].flat();
  const organization = graph.find((node) => types(node).includes("Organization"));
  check(organization?.name === "OfferKit" && organization.url === `${origin}/`
    && organization.logo === `${origin}/icon.png`
    && organization.sameAs?.includes("https://github.com/offerkit/offerkit"), "missing organization identity, logo, or verified profile");
  const docPath = url.replace(/^\/docs\/(next|v\/[^/]+)\//, "/docs/");
  const docHub = /^\/docs\/(?:deploy\/|integrate\/|operate\/|reference\/|solutions\/)?$/.test(docPath);
  const isArticle = (url.startsWith("/docs/") && !docHub) || (url.startsWith("/blog/") && url !== "/blog/");
  const article = graph.find((node) => types(node).includes("Article"));
  if (isArticle) {
    check(Boolean(article?.headline && article.author && article.publisher && article.image?.length), "article schema lacks headline, author, publisher, or image");
    check(article?.url === `${origin}${url}` && article?.description === description, "article metadata differs from page metadata");
    if (url.startsWith("/blog/")) check(Boolean(article?.datePublished && !Number.isNaN(Date.parse(article.datePublished))), "blog publication date missing or invalid");
  } else check(!article, "non-article page should not claim Article schema");

  for (const match of page.html.matchAll(/<a\b[^>]*>/g)) {
    const link = attributes(match[0]);
    if (!link.href || /\bnofollow\b/.test(link.rel ?? "")) continue;
    const target = new URL(link.href, `${origin}${url}`);
    if (target.origin !== origin || (target.pathname === url && !target.search)) continue;
    const destination = target.pathname.endsWith("/") || /\.[^/]+$/.test(target.pathname)
      ? target.pathname : `${target.pathname}/`;
    check(!redirects.has(destination), `internal link points to redirect ${destination}`);
    const linkedPage = pages.get(destination);
    linkedPage?.incoming.add(url);
    if (!page.noIndex) linkedPage?.indexableIncoming.add(url);
  }
}
for (const [url, page] of pages) {
  if (url === "/404.html") continue;
  if (page.incoming.size < 2) failures.push(`${url}: only ${page.incoming.size} distinct incoming internal links`);
  if (!page.noIndex && page.indexableIncoming.size < 2) failures.push(`${url}: only ${page.indexableIncoming.size} distinct incoming links from indexable pages`);
}
if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`SEO checks passed for ${pages.size} pages: descriptions, HTTPS canonicals, structured data, version indexing, and incoming links.\n`);
}
