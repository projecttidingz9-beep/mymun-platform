"use client";

export async function ensureServerSession(payload: {
  email: string;
  role: "delegate" | "organizer" | "admin";
  name?: string;
}) {
  try {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
  } catch {
    // best-effort session hydration for protected APIs
  }
}
