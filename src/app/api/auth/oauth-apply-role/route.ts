import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  bridgeOAuthSignIn,
  setMymunSessionCookie,
} from "@/lib/server/oauth-bridge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  role: z.enum(["delegate", "organizer"]),
});

/**
 * Finishes sign-up when OAuth returned `needs_role` (e.g. first Google sign-in from Sign In tab).
 * Requires an active Supabase session from the OAuth redirect.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Role is required." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: "Session expired. Try signing in again." }, { status: 401 });
    }

    const email = user.email.trim().toLowerCase();
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const name =
      (typeof meta?.full_name === "string" && meta.full_name) ||
      (typeof meta?.name === "string" && meta.name) ||
      email.split("@")[0] ||
      "User";

    const result = await bridgeOAuthSignIn({
      email,
      name,
      emailVerified: Boolean(user.email_confirmed_at),
      requestedRole: parsed.data.role,
    });

    if (result.kind === "error") {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    if (result.kind === "needs_role") {
      return NextResponse.json({ error: "Could not complete account." }, { status: 400 });
    }

    const res = NextResponse.json({
      ok: true,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    });
    setMymunSessionCookie(res, result.sessionToken);
    await supabase.auth.signOut();
    return res;
  } catch {
    return NextResponse.json({ error: "Could not complete sign-up." }, { status: 400 });
  }
}
