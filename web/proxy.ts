import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/reset-password",
  "/reset-password",
  "/report",
];

const PROTECTED_PATHS = [
    "/",
"/vehicles",
  "/reports",
  "/staff",
  "/settings",
  "/activities",
  "/crm",
  "/customers",
  "/integrations",
  "/leads",
  "/platform",
  "/saas",
  "/trade-appraisals",
];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const { pathname } = request.nextUrl;

  const hostname = (
    request.headers.get("host") ?? request.nextUrl.hostname
  )
    .split(":")[0]
    .toLowerCase();

  if (
    hostname === "bcautoloan.ca" ||
    hostname === "www.bcautoloan.ca"
  ) {
    const isBCAssetOrApi =
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/images") ||
      pathname.startsWith("/favicon");

    if (isBCAssetOrApi) {
      return response;
    }

    // Keep the existing internal icon and sitemap routes available.
    if (pathname === "/bcautoloan/icon.png" ||
        pathname === "/bcautoloan/sitemap.xml") {
      return response;
    }

    if (pathname === "/icon.png") {
      return NextResponse.rewrite(new URL("/bcautoloan/icon.png", request.url));
    }

    if (pathname === "/sitemap.xml") {
      return NextResponse.rewrite(new URL("/bcautoloan/sitemap.xml", request.url));
    }

    if (pathname === "/robots.txt") {
      return response;
    }

    // Redirect legacy public URLs to their clean equivalents.
    if (pathname === "/bcautoloan" || pathname === "/bcautoloan/") {
      return NextResponse.redirect(new URL("/", request.url), 308);
    }

    if (pathname.startsWith("/bcautoloan/")) {
      const legacyPath = pathname.slice("/bcautoloan".length);
      let cleanPath = legacyPath;

      if (
        legacyPath === "/pre-approved" ||
        legacyPath === "/getapproved"
      ) {
        cleanPath = "/getapproved";
      }

      return NextResponse.redirect(
        new URL(`${cleanPath}${request.nextUrl.search}`, request.url),
        308
      );
    }

    // /getapproved is already a real top-level route.
    // Rewrite the other clean public paths to their internal pages.
    if (pathname !== "/getapproved" &&
        !pathname.startsWith("/getapproved/")) {
      const targetPath =
        pathname === "/" ? "/bcautoloan" : `/bcautoloan${pathname}`;

      return NextResponse.rewrite(new URL(targetPath, request.url));
    }
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    matchesPath(pathname, path)
  );

  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    matchesPath(pathname, path)
  );

  const isApiPath = pathname.startsWith("/api");

  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  /*
   * Protected application pages
   *
   * Logged-out users must be sent to Login.
   *
   * Password recovery is intentionally public because
   * Supabase establishes the recovery session before
   * the user reaches /reset-password.
   */
  if (
    !user &&
    isProtectedPath &&
    !isPublicPath &&
    !isApiPath &&
    !isStaticAsset
  ) {
    const loginUrl = new URL("/login", request.url);

    loginUrl.searchParams.set("redirectTo", pathname);

    return NextResponse.redirect(loginUrl);
  }

  /*
   * Authenticated users should not return to Login or Signup.
   */
  if (
    user &&
    (pathname === "/login" || pathname === "/signup")
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
