import { getCollection } from "astro:content";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function slugFor(id: string) {
  return id.replace(/\.(md|mdx)$/, "");
}

export async function GET() {
  const posts = (await getCollection("blog"))
    .filter((post) => !post.data.draft)
    .sort((left, right) => right.data.publishedAt.valueOf() - left.data.publishedAt.valueOf());

  const items = posts
    .map((post) => {
      const url = `https://offerkit.dev/blog/${slugFor(post.id)}/`;
      return `<item><title>${escapeXml(post.data.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${post.data.publishedAt.toUTCString()}</pubDate><description>${escapeXml(post.data.description)}</description></item>`;
    })
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>OfferKit blog</title><link>https://offerkit.dev/blog</link><description>Notes on building reliable, self-hosted promotion infrastructure.</description>${items}</channel></rss>`;

  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
