export const APP_ROUTE_PREFIXES = [
  "/client",
  "/admin",
  "/operator",
  "/sign-in",
  "/sign-up",
  "/auth",
  "/sso-callback",
  "/access-denied",
] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function effectiveThemeForPathname(
  pathname: string,
  preference: "dark" | "light",
): "dark" | "light" {
  return isAppRoute(pathname) ? preference : "dark";
}
