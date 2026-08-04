import type { APIRoute } from "astro";
import { createSearchServer } from "@/lib/search";

const server = createSearchServer("next");

export const GET: APIRoute = () => server.staticGET();
