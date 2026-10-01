import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** The session is only ever read on the server, so scripts in the page never get it. */
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/** True when the admin sign-in can work (URL + publishable key on the server). */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Supabase client acting as the signed-in visitor (session in HTTP-only cookies).
 * Uses the publishable key, so every query is subject to RLS — the CRM tables only
 * answer for users on the crm_admins allow-list.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}
