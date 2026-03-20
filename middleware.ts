import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PATHS = ["/", "/students", "/academic-progress", "/dashboard"];
const AUTH_PAGES = ["/login", "/register"];

function matchesPath(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = Boolean(token);

  if (!isAuthenticated && matchesPath(pathname, PROTECTED_PATHS)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && matchesPath(pathname, AUTH_PAGES)) {
    const studentsUrl = new URL("/students", request.url);
    return NextResponse.redirect(studentsUrl);
  }

  if (isAuthenticated && pathname === "/" && !search) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/students/:path*", "/academic-progress/:path*", "/dashboard/:path*"],
};
