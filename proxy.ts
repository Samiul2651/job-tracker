import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

// Everything needs a login except the login page, the MCP route (own token),
// the health check and static files.
export async function proxy(request: NextRequest) {
  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|api/mcp|api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)"],
};
