import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  OAUTH_ROLE_INTENT_COOKIE,
  bridgeOAuthSignIn,
  setMymunSessionCookie,
} from "@/lib/server/oauth-bridge";
import { createSupabaseCallbackClient } from "@/lib/supabase/server";

function absoluteUrl(request: NextRequest, pathname: string) {
  const base = request.nextUrl.origin;
  return new URL(pathname, base);
}

function clearOAuthIntentCookie(response: NextResponse, secure: boolean) {
  response.cookies.set(OAUTH_ROLE_INTENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
}

/** OAuth provider emails are treated as verified when present. */
function oauthEmailVerified(user: {
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}): boolean {
  if (user.email_confirmed_at || user.confirmed_at) return true;
  return Boolean(user.email?.trim());
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") || "/dashboard";
  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";
  const secure = process.env.NODE_ENV === "production";

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return NextResponse.redirect(absoluteUrl(request, "/?error=supabase_config"));
  }

  if (!code) {
    return NextResponse.redirect(absoluteUrl(request, "/?error=oauth"));
  }

  try {
    const { supabase, applyCookiesTo } = createSupabaseCallbackClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const redirect = NextResponse.redirect(absoluteUrl(request, "/?error=oauth_exchange"));
      return applyCookiesTo(redirect);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.email) {
      const redirect = NextResponse.redirect(absoluteUrl(request, "/?error=oauth_user"));
      return applyCookiesTo(redirect);
    }

    const email = user.email.trim().toLowerCase();
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const name =
      (typeof meta?.full_name === "string" && meta.full_name) ||
      (typeof meta?.name === "string" && meta.name) ||
      email.split("@")[0] ||
      "User";

    const intent = request.cookies.get(OAUTH_ROLE_INTENT_COOKIE)?.value;
    const requestedRole =
      intent === "organizer" ? ("organizer" as const) : intent === "delegate" ? ("delegate" as const) : null;

    const result = await bridgeOAuthSignIn({
      email,
      name,
      emailVerified: oauthEmailVerified(user),
      requestedRole,
    });

    if (result.kind === "needs_role") {
      const redirect = NextResponse.redirect(absoluteUrl(request, "/auth/complete-role"));
      clearOAuthIntentCookie(redirect, secure);
      return applyCookiesTo(redirect);
    }

    if (result.kind === "error") {
      await supabase.auth.signOut();
      const q = new URLSearchParams({ error: "oauth_bridge", detail: result.message });
      const redirect = NextResponse.redirect(absoluteUrl(request, `/?${q.toString()}`));
      return applyCookiesTo(redirect);
    }

    const redirect = NextResponse.redirect(absoluteUrl(request, nextPath));
    clearOAuthIntentCookie(redirect, secure);
    setMymunSessionCookie(redirect, result.sessionToken);
    return applyCookiesTo(redirect);
  } catch {
    return NextResponse.redirect(absoluteUrl(request, "/?error=oauth_exchange"));
  }
}
