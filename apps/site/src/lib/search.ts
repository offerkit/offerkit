import { createFromSource } from "fumadocs-core/search/server";
import { getDocsVariant, getStructuredData } from "@/lib/source";
import { canonicalDocsUrl } from "./docs-aliases.mjs";

export function createSearchServer(variantId: string) {
  const variant = getDocsVariant(variantId);
  return createFromSource({
    ...variant.source,
    getPages: (language) => variant.source.getPages(language)
      .filter((page) => canonicalDocsUrl(page.url) === page.url),
  }, {
    buildIndex(page) {
      return {
        id: page.data._raw.id,
        title: page.data.title,
        description: page.data.description,
        structuredData: getStructuredData(page.data._raw),
        url: page.url,
      };
    },
  });
}
