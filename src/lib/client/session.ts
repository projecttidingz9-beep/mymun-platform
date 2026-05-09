"use client";

/** Best-effort: verify session with the server (no request body; identity comes from the HTTP-only cookie). */
export async function ensureServerSession() {
  try {
    await fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
    });
  } catch {
    // best-effort for protected APIs
  }
}
