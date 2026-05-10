import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  OAUTH_ROLE_INTENT_COOKIE,
  bridgeOAuthSignIn,
  setMymunSessionCookie,
} from "@/lib/server/oauth-bridge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function absoluteUrl(request: NextRequest, pathname: string) {
  const base = request.nextUrl.origin;
  return new URL(pathname, base);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") || "/dashboard";
  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return NextResponse.redirect(absoluteUrl(request, "/?error=supabase_config"));
  }

  if (!code) {
    return NextResponse.redirect(absoluteUrl(request, "/?error=oauth"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(absoluteUrl(request, "/?error=oauth_exchange"));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.redirect(absoluteUrl(request, "/?error=oauth_user"));
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
    emailVerified: Boolean(user.email_confirmed_at ?? user.confirmed_at),
    requestedRole,
  });

  const secure = process.env.NODE_ENV === "production";

  if (result.kind === "needs_role") {
    const redirect = NextResponse.redirect(absoluteUrl(request, "/auth/complete-role"));
    redirect.cookies.set(OAUTH_ROLE_INTENT_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
    return redirect;
  }

  if (result.kind === "error") {
    await supabase.auth.signOut();
    const q = new URLSearchParams({ error: "oauth_bridge", detail: result.message });
    return NextResponse.redirect(absoluteUrl(request, `/?${q.toString()}`));
  }

  const redirect = NextResponse.redirect(absoluteUrl(request, nextPath));
  redirect.cookies.set(OAUTH_ROLE_INTENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  setMymunSessionCookie(redirect, result.sessionToken);
  return redirect;
}
