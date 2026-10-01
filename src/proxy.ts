import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);
const ADMIN_PATH = /^\/(?:(?:fa|ar)\/)?admin(?:\/|$)/;

/**
 * Locale routing for every page. On the private panel it also refreshes the Supabase
 * session, so the HTTP-only auth cookies stay valid (pages cannot set cookies).
 */
export default async function proxy(request: NextRequest) {
  if (!ADMIN_PATH.test(request.nextUrl.pathname)) return intl(request);

  // Refresh first: updated cookies are written to the request (which next-intl forwards
  // to the page) and then to the response for the browser.
  const refreshed = await refreshSession(request);
  const response = intl(request);
  for (const { name, value, options } of refreshed) response.cookies.set(name, value, options);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

type CookieToSet = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

async function refreshSession(request: NextRequest): Promise<CookieToSet[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const toSet: CookieToSet[] = [];
  const supabase = createServerClient(url, key, {
    // Same as src/lib/supabase/server.ts (kept inline: the proxy must not import server-only modules).
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          request.cookies.set(name, value);
          toSet.push({ name, value, options });
        }
      },
    },
  });
  await supabase.auth.getUser().catch(() => null);
  return toSet;
}

export const config = {
  // Everything except API routes, Next.js internals, Vercel internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
