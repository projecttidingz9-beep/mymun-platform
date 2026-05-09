"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [err, setErr] = useState("");

  const submit = async () => {
    setStatus("loading");
    setErr("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
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
          <input
            className="input-base"
            placeholder="Your email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <textarea
            className="input-base min-h-[120px]"
            placeholder="How can we help?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {err && (
            <p className="text-xs text-red-600" role="alert">
              {err}
            </p>
          )}
          {status === "ok" && <p className="text-xs text-green-700">Thanks — we&apos;ll get back to you.</p>}
          <button type="button" className="btn btn-primary w-full py-3" disabled={status === "loading"} onClick={submit}>
            {status === "loading" ? "Sending…" : "Send message"}
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
