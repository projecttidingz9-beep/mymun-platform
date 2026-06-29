"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppRouteSkeleton from "@/components/AppRouteSkeleton";
import { useAuth } from "@/lib/auth-context";
import { CONFERENCES_PATH } from "@/lib/paths";

export default function PaymentReturnPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authReady, isLoggedIn, refreshUserProfile } = useAuth();
  const eventKey = String(params.id || "");
  const orderId = searchParams.get("order_id")?.trim() || "";

  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [message, setMessage] = useState("Confirming your payment...");

  useEffect(() => {
    if (!authReady) return;
    if (!isLoggedIn) {
      router.replace(`/login?next=${encodeURIComponent(`/checkout/${eventKey}/payment-return?order_id=${orderId}`)}`);
      return;
    }
    if (!orderId) {
      setStatus("error");
      setMessage("Missing payment reference. Return to checkout and try again.");
      return;
    }

    let cancelled = false;
    const poll = async (attempt: number) => {
      try {
        const res = await fetch(`/api/payments/cashfree/orders/${encodeURIComponent(orderId)}`, {
          credentials: "include",
        });
        const payload = (await res.json().catch(() => ({}))) as {
          paid?: boolean;
          orderStatus?: string;
          error?: string;
        };

        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          setMessage(payload.error || "Could not verify payment.");
          return;
        }

        if (payload.paid || payload.orderStatus?.toUpperCase() === "PAID") {
          setStatus("paid");
          setMessage("Payment successful. Your registration is confirmed.");
          void refreshUserProfile();
          return;
        }

        if (attempt < 8) {
          window.setTimeout(() => void poll(attempt + 1), 2000);
          return;
        }

        setStatus("pending");
        setMessage("Payment is still processing. Check your dashboard in a few minutes.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Could not verify payment status.");
        }
      }
    };

    void poll(0);
    return () => {
      cancelled = true;
    };
  }, [authReady, isLoggedIn, orderId, eventKey, router, refreshUserProfile]);

  if (!authReady) {
    return (
      <>
        <Navbar />
        <AppRouteSkeleton />
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="card p-8 rounded-2xl max-w-md w-full space-y-4 text-center">
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
            {status === "paid" ? "Payment complete" : status === "pending" ? "Payment pending" : status === "error" ? "Payment issue" : "Processing payment"}
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            {message}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => router.push("/dashboard#conferences")}
            >
              Go to dashboard
            </button>
            <Link href={`/checkout/${eventKey}`} className="btn btn-ghost w-full">
              Back to checkout
            </Link>
            <Link href={CONFERENCES_PATH} className="text-xs" style={{ color: "var(--fg-muted)" }}>
              Browse conferences
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
