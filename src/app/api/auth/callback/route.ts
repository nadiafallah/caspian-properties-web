import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

// Only the private panel is a valid destination after signing in.
const SAFE_NEXT = /^\/(?:(?:fa|ar)\/)?admin(?:\/[\w\-/]*)?$/;
const OTP_TYPES: EmailOtpType[] = ["magiclink", "email", "signup", "invite", "recovery", "email_change"];

/** Completes the emailed sign-in link (PKCE code or token hash) and sets the session cookies. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const nextParam = params.get("next") ?? "";
  const next = SAFE_NEXT.test(nextParam) ? nextParam : "/admin";
  const loginUrl = new URL(`${next.replace(/\/admin.*$/, "")}/admin/login?error=link`, request.url);

  if (!isAuthConfigured()) return NextResponse.redirect(loginUrl);
  const supabase = await createSupabaseServerClient();

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const response = NextResponse.redirect(ok ? new URL(next, request.url) : loginUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
