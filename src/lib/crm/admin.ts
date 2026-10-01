import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/locales";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

export type AdminContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
};

/**
 * The signed-in user, verified with Supabase Auth (not just decoded from the cookie),
 * and whether they are on the CRM allow-list. Cached per request.
 */
export const getAdminSession = cache(async (): Promise<{ ctx: AdminContext | null; signedIn: boolean }> => {
  if (!isAuthConfigured()) return { ctx: null, signedIn: false };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ctx: null, signedIn: false };
  const { data: isAdmin } = await supabase.rpc("crm_is_admin");
  if (isAdmin !== true) return { ctx: null, signedIn: true };
  return { ctx: { supabase, userId: data.user.id, email: data.user.email ?? "" }, signedIn: true };
});

export function adminPath(locale: AppLocale, href: string): string {
  return getPathname({ locale, href });
}

/** For pages: sends visitors who are not signed in to the sign-in page. */
export async function requireAdminPage(locale: AppLocale): Promise<AdminContext | "forbidden"> {
  const { ctx, signedIn } = await getAdminSession();
  if (ctx) return ctx;
  if (signedIn) return "forbidden";
  redirect(adminPath(locale, "/admin/login"));
}
