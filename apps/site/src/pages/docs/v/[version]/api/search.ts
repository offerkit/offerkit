import type { APIRoute } from "astro";
import { createSearchServer } from "@/lib/search";
import { getArchivedVariants } from "@/lib/source";

interface Props {
  variantId: string;
}

export function getStaticPaths() {
  return getArchivedVariants().map((variant) => ({
    params: { version: variant.version },
    props: { variantId: variant.id },
  }));
}

export const GET: APIRoute<Props> = ({ props }) =>
  createSearchServer(props.variantId).staticGET();
