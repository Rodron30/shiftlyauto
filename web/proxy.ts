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

  const { pathname } = request.nextUrl;

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