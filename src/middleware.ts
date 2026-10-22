import { NextResponse, type NextRequest } from "next/server";

// Cheap first gate: bounce requests with no session cookie to the right
// login page. The real checks (valid session, right business, roles) run in
// requireStaff() and requirePlatformUser().
export function middleware(req: NextRequest) {
  const platform = req.nextUrl.pathname.startsWith("/platform");
  if (!req.cookies.has(platform ? "platform_session" : "staff_session")) {
    return NextResponse.redirect(new URL(platform ? "/platform/login" : "/admin/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/((?!login).*)", "/platform", "/platform/((?!login).*)"] };
