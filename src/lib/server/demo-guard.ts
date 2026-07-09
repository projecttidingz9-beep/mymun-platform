import { NextResponse } from "next/server";

export const DEMO_EMAIL_DOMAIN = "@tidingz.demo";

export function isDemoAccount(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}

export function demoDenied() {
  return NextResponse.json(
    { error: "Demo accounts are read-only. Log in with a real account to save changes." },
    { status: 403 }
  );
}
