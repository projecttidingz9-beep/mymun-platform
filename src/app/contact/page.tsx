"use client";

import { useState, type FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [err, setErr] = useState("");

  const validate = () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes("@")) {
      return "Enter a valid email address.";
    }
    if (message.trim().length < 10) {
      return "Message must be at least 10 characters.";
    }
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      setStatus("err");
      return;
    }

    setStatus("loading");
    setErr("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), message: message.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error || "Could not send.");
        setStatus("err");
        return;
      }
      setStatus("ok");
      setMessage("");
    } catch {
      setErr("Network error.");
      setStatus("err");
    }
  };

  return (
    <>
      <Navbar />
      <main className="app-shell">
        <div className="max-w-lg mx-auto px-4 py-16 space-y-6">
          <h1 className="app-title text-2xl">Contact</h1>
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            Reach the Tidingz team — we read every message.
          </p>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="contact-email" className="text-xs font-medium block mb-1">
                Your email
              </label>
              <input
                id="contact-email"
                className="input-base w-full"
                placeholder="you@school.edu"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="text-xs font-medium block mb-1">
                Message
              </label>
              <textarea
                id="contact-message"
                className="input-base min-h-[120px] w-full"
                placeholder="How can we help?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {err && (
              <p className="text-xs text-red-600" role="alert">
                {err}
              </p>
            )}
            {status === "ok" && <p className="text-xs text-green-700">Thanks — we&apos;ll get back to you.</p>}
            <button type="submit" className="btn btn-primary w-full py-3" disabled={status === "loading"}>
              {status === "loading" ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
