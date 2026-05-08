import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/api", "/_next", "/favicon.ico"];
const CHANGE_PASSWORD_PATH = "/change-password";

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await auth().api.getSession({ headers: req.headers });

  if (!session) {
    if (pathname === "/sign-in") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const mustChange = (session.user as { mustChangePassword?: boolean }).mustChangePassword === true;
  if (mustChange && pathname !== CHANGE_PASSWORD_PATH) {
    const url = req.nextUrl.clone();
    url.pathname = CHANGE_PASSWORD_PATH;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
