import { createFromSource } from "fumadocs-core/search/server";
import { getDocsVariant, getStructuredData } from "@/lib/source";

export function createSearchServer(variantId: string) {
  const variant = getDocsVariant(variantId);
  return createFromSource(variant.source, {
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
