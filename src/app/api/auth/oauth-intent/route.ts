import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OAUTH_ROLE_INTENT_COOKIE } from "@/lib/server/oauth-bridge";

const bodySchema = z.object({
  role: z.enum(["delegate", "organizer"]).optional(),
});

/**
 * Stores chosen account type before Supabase OAuth redirect (register tab).
 * Omit `role` or POST `{}` to clear intent (sign-in tab — new users finish at /auth/complete-role).
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";

  if (parsed.data.role) {
    res.cookies.set(OAUTH_ROLE_INTENT_COOKIE, parsed.data.role, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 600,
    });
  } else {
    res.cookies.set(OAUTH_ROLE_INTENT_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
