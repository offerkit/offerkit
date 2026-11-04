import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Config redirects match without case sensitivity, so /MCP → /mcp there
  // would also redirect the canonical /mcp back to itself.
  if (pathname !== "/mcp" && pathname.toLowerCase() === "/mcp") {
    const url = request.nextUrl.clone();
    url.pathname = "/mcp";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/([mM][cC][pP])",
};
