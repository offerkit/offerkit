import type { APIRoute } from "astro";
import { createSearchServer } from "@/lib/search";

const server = createSearchServer("stable");

export const GET: APIRoute = () => server.staticGET();
