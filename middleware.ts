import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Everything in the app requires a logged-in session except the login page
// itself, the login API call, and Next's own static assets.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let authed = false;

  if (token) {
    try {
      const ctx = getRequestContext();
      const db = (ctx.env as any).DB;
      const session = await db
        .prepare(
          "SELECT 1 FROM app_sessions WHERE token = ? AND expires_at > datetime('now','localtime')"
        )
        .bind(token)
        .first();
      authed = !!session;
    } catch {
      authed = false;
    }
  }

  if (authed) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "লগইন করা নেই" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - _next/static, _next/image (Next internals/assets)
     * - favicon.ico, manifest, and other top-level static files with an
     *   extension (icons, images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml)$).*)",
  ],
};
