import { NextResponse, type NextRequest } from "next/server";

// Cheap first gate: bounce requests with no session cookie to the login page.
// The real check (valid, unexpired session + roles) runs in requireStaff().
export function middleware(req: NextRequest) {
  if (!req.cookies.has("beeze_staff")) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/((?!login).*)"] };
