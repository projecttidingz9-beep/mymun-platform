"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";
import { getDefaultConferenceRegistrationCategories } from "@/lib/registration-category-types";

export default function CreateOrganizerConferencePage() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { isLoggedIn, user, addOrganizerConference } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState(false);

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");

  const contactDetail = [email.trim(), phone.trim()].filter(Boolean).join(" · ");

  const canSubmit =
    title.trim() &&
    city.trim() &&
    country.trim() &&
    organizerName.trim() &&
    phone.trim() &&
    email.trim() &&
    Number(capacity) > 0;

  const handleSubmit = async (): Promise<void> => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitMessage("");
    setSubmitError(false);

    if (user?.role === "delegate") {
      setSubmitError(true);
      setSubmitMessage(
        "Your account is registered as a delegate. Sign up with an organizer account to create conferences."
      );
      setIsSubmitting(false);
      return;
    }

    if (user?.emailVerified === false) {
      setSubmitError(true);
      setSubmitMessage(
        "Please verify your email before creating a conference. Open your dashboard to resend the verification link."
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await addOrganizerConference({
        title: title.trim(),
        city: city.trim(),
        country: country.trim(),
        organizerName: organizerName.trim(),
        contactDetail,
        venue: venue.trim() || undefined,
        level: "Open",
        capacity: Number(capacity),
        // Exact dates are configured later from the organizer dashboard — the server fills in
        // a sane placeholder range when these are left blank at creation time.
        startDate: "",
        endDate: "",
        currency: "INR",
        socialLinks: {},
        registrationCategories: getDefaultConferenceRegistrationCategories(),
        committees: [],
      });
      if (!result.ok) {
        setSubmitError(true);
        if (result.code === "EMAIL_NOT_VERIFIED") {
          setSubmitMessage(
            "Please verify your email before creating a conference. Open your dashboard to resend the verification link."
          );
        } else {
          setSubmitMessage(result.error ?? "Could not create conference. Please try again.");
        }
        return;
      }
      setSubmitError(false);
      setSubmitMessage("Conference created as Draft. Go to your dashboard and click Publish to make it visible on the marketplace.");
      router.push("/organizers/dashboard");
    } catch {
      setSubmitError(true);
      setSubmitMessage("Could not create conference. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh]" style={{ background: "var(--bg)" }}>
      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab="register"
        defaultRegisterRole="organizer"
      />
      <main className="pt-[calc(7rem+env(safe-area-inset-top,0px))] pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {!hydrated ? (
            <div className="app-card space-y-4">
              <div className="skeleton h-8 w-48 rounded-lg" />
              <div className="skeleton h-4 w-full max-w-md rounded-md" />
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="skeleton h-12 rounded-xl w-full" />
                <div className="skeleton h-12 rounded-xl w-full" />
                <div className="skeleton h-12 rounded-xl w-full" />
                <div className="skeleton h-12 rounded-xl w-full" />
              </div>
              <div className="skeleton h-32 rounded-xl w-full mt-4" />
            </div>
          ) : (
          <div className="app-card">
            <div className="app-header" style={{ marginBottom: 18 }}>
              <div className="app-header-copy">
                <div className="section-label mb-2">Organizer Onboarding</div>
                <h1 className="app-title">Create Conference</h1>
                <p className="app-subtitle mt-2">
                  Just the basics for now — dates, registration pricing, and committees are all configured
                  from your dashboard afterward. Create your conference as Draft, then open your dashboard
                  and click Publish when ready to go live.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="app-sidebar-picker-label">Conference Name *</label>
                <input className="input-base mt-2" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="app-sidebar-picker-label">Organizing Body *</label>
                <input className="input-base mt-2" value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} />
              </div>
              <div>
                <label className="app-sidebar-picker-label">City *</label>
                <input className="input-base mt-2" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className="app-sidebar-picker-label">Country *</label>
                <input className="input-base mt-2" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div>
                <label className="app-sidebar-picker-label">Phone *</label>
                <input
                  className="input-base mt-2"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="app-sidebar-picker-label">Email *</label>
                <input
                  className="input-base mt-2"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="organizers@yourconference.com"
                />
              </div>
              <div>
                <label className="app-sidebar-picker-label">Approximate Capacity *</label>
                <input
                  className="input-base mt-2"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g. 200"
                />
              </div>
              <div>
                <label className="app-sidebar-picker-label">Venue (optional)</label>
                <input className="input-base mt-2" value={venue} onChange={(e) => setVenue(e.target.value)} />
              </div>
            </div>

            {submitMessage && (
              <div
                className="mt-4 rounded-xl px-4 py-3 space-y-2"
                style={
                  submitError
                    ? { background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)" }
                    : { background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.25)" }
                }
              >
                <p className="text-sm" style={{ color: submitError ? "#b91c1c" : "#15803d" }}>
                  {submitMessage}
                </p>
                {submitError && user?.role === "delegate" && (
                  <Link href="/organizers" className="btn btn-ghost text-xs inline-flex">
                    Register as organizer
                  </Link>
                )}
                {submitError &&
                  (user?.emailVerified === false || submitMessage.toLowerCase().includes("verify your email")) && (
                    <Link href="/dashboard" className="btn btn-ghost text-xs inline-flex">
                      Open dashboard to verify email
                    </Link>
                  )}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push("/organizers")}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
                style={{ opacity: canSubmit && !isSubmitting ? 1 : 0.6 }}
              >
                {isSubmitting ? "Submitting..." : "Submit Conference"}
              </button>
            </div>
          </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
