import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { guestOnlyRoutePatterns, protectedRoleRoutePatterns, roleRoutingPaths } from "@/constants/roles";
import { isClerkConfigured } from "@/lib/clerk-config";

const signInPath = "/sign-in";
const signUpPath = "/sign-up";
const isProtectedRoute = createRouteMatcher([...protectedRoleRoutePatterns]);
const isGuestOnlyRoute = createRouteMatcher([...guestOnlyRoutePatterns]);
const clerkEnabled = isClerkConfigured();

function hasNestedAuthPath(pathname: string) {
  return pathname.includes(`${signInPath}`) || pathname.includes(`${signUpPath}`);
}

function getRequestOrigin(req: Request) {
  const requestUrl = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host") ?? requestUrl.host;
  const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

function createSignInRedirectUrl(req: Request) {
  const requestUrl = new URL(req.url);
  const origin = getRequestOrigin(req);
  const signInUrl = new URL(signInPath, origin);
  const returnBackUrl = hasNestedAuthPath(requestUrl.pathname)
    ? new URL("/client", origin)
    : new URL(`${requestUrl.pathname}${requestUrl.search}`, origin);

  signInUrl.searchParams.set("redirect_url", returnBackUrl.toString());

  return signInUrl;
}

const clerkProtectedMiddleware = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.redirect(createSignInRedirectUrl(req));
    }
  }

  if (isGuestOnlyRoute(req)) {
    const { userId } = await auth();

    if (userId) {
      return NextResponse.redirect(new URL(roleRoutingPaths.authContinue, req.url));
    }
  }
}, {
  signInUrl: signInPath,
  signUpUrl: signUpPath,
});

export default clerkEnabled
  ? clerkProtectedMiddleware
  : function proxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|mp4|webm|mov|m4v|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
