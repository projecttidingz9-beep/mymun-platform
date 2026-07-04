import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  }
  return { url, key };
}

export async function createSupabaseServerClient() {
  const { url, key } = supabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* ignore when called from a Server Component context that forbids cookie mutation */
        }
      },
    },
  });
}

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * Route-handler client that buffers Set-Cookie values so they can be applied to a
 * `NextResponse.redirect()` (cookies().set alone is not always merged onto custom responses).
 */
export function createSupabaseCallbackClient(request: NextRequest) {
  const { url, key } = supabasePublicConfig();
  const pending: PendingCookie[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options });
        });
      },
    },
  });

  function applyCookiesTo(response: NextResponse) {
    for (const { name, value, options } of pending) {
      response.cookies.set(name, value, options);
    }
    return response;
  }

  return { supabase, applyCookiesTo };
}
