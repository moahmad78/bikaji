import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Protect sub-paths under admin, kitchen, waiter, and billing areas
  // Allows loading the root index login portals (e.g. /admin, /kitchen, /waiter, /billing)
  const isAdminSubPath = path.startsWith("/admin") && path !== "/admin";
  const isKitchenSubPath = path.startsWith("/kitchen") && path !== "/kitchen";
  const isWaiterSubPath = path.startsWith("/waiter") && path !== "/waiter";
  const isBillingSubPath = path.startsWith("/billing") && path !== "/billing";

  if (isAdminSubPath || isKitchenSubPath || isWaiterSubPath || isBillingSubPath) {
    const sessionCookieName = "better-auth.session_token";
    const sessionToken = request.cookies.get(sessionCookieName) || request.cookies.get(`__secure-${sessionCookieName}`);

    // If no session token cookie is found, redirect directly to portal entry login pages
    if (!sessionToken) {
      if (isAdminSubPath) return NextResponse.redirect(new URL("/admin", request.url));
      if (isKitchenSubPath) return NextResponse.redirect(new URL("/kitchen", request.url));
      if (isWaiterSubPath) return NextResponse.redirect(new URL("/waiter", request.url));
      if (isBillingSubPath) return NextResponse.redirect(new URL("/billing", request.url));
    }

    try {
      // Query local Better Auth get-session endpoint forwarding request cookies
      const sessionUrl = new URL("/api/auth/get-session", request.url);
      const res = await fetch(sessionUrl, {
        headers: {
          cookie: request.headers.get("cookie") || ""
        }
      });

      if (!res.ok) {
        throw new Error(`Auth endpoint returned status: ${res.status}`);
      }

      const data = await res.json();
      const user = data?.user;

      if (!user) {
        if (isAdminSubPath) return NextResponse.redirect(new URL("/admin", request.url));
        if (isKitchenSubPath) return NextResponse.redirect(new URL("/kitchen", request.url));
        if (isWaiterSubPath) return NextResponse.redirect(new URL("/waiter", request.url));
        if (isBillingSubPath) return NextResponse.redirect(new URL("/billing", request.url));
      }

      const role = user.role;

      // Enforce specific role boundaries
      if (isAdminSubPath && !["ADMIN", "SUPER_ADMIN"].includes(role)) {
        return NextResponse.rewrite(new URL("/api/auth/forbidden", request.url));
      }
      if (isKitchenSubPath && !["KITCHEN", "ADMIN", "SUPER_ADMIN"].includes(role)) {
        return NextResponse.rewrite(new URL("/api/auth/forbidden", request.url));
      }
      if (isWaiterSubPath && !["WAITER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
        return NextResponse.rewrite(new URL("/api/auth/forbidden", request.url));
      }
      if (isBillingSubPath && !["CASHIER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
        return NextResponse.rewrite(new URL("/api/auth/forbidden", request.url));
      }

    } catch (err) {
      console.error("[Middleware Security Guard] Error verifying session cookie:", err);
      // Fallback: Redirect to entry portals to prevent bypass
      if (isAdminSubPath) return NextResponse.redirect(new URL("/admin", request.url));
      if (isKitchenSubPath) return NextResponse.redirect(new URL("/kitchen", request.url));
      if (isWaiterSubPath) return NextResponse.redirect(new URL("/waiter", request.url));
      if (isBillingSubPath) return NextResponse.redirect(new URL("/billing", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/kitchen/:path*",
    "/waiter/:path*",
    "/billing/:path*"
  ]
};
