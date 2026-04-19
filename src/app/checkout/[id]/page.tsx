"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { CONFERENCES } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { Registration } from "@/lib/types";

type Step = 1 | 2 | 3 | 4;

const COUNTRIES = [
  "Argentina", "Australia", "Brazil", "Canada", "China", "Egypt", "France",
  "Germany", "India", "Indonesia", "Japan", "Kenya", "Mexico", "Nigeria",
  "Pakistan", "Russia", "Saudi Arabia", "South Africa", "United Kingdom",
  "United States", "Italy", "Spain", "South Korea", "Turkey", "Iran",
];

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, user, addRegistration } = useAuth();
  const [step, setStep] = useState<Step>(1);

  // Form state
  const [fullName, setFullName] = useState(user?.name || "");
  const [school, setSchool] = useState(user?.school || "");
  const [phone, setPhone] = useState("");
  const [selectedCommittee, setSelectedCommittee] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [experience, setExperience] = useState("beginner");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState(user?.name || "");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");

  const conference = CONFERENCES.find((c) => c.id === params.id);

  useEffect(() => {
    if (!isLoggedIn) router.push("/");
    if (user) { setFullName(user.name); setCardName(user.name); }
  }, [isLoggedIn, user, router]);

  if (!conference) return null;

  const c = conference;
  const currencySymbol = c.currency === "USD" ? "$" : c.currency === "EUR" ? "€" : c.currency === "GBP" ? "£" : "$";
  const committee = c.committees.find((cm) => cm.id === selectedCommittee);

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v: string) =>
    v.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");

  const handlePay = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    const confId = "MYM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    setConfirmationId(confId);

    const registration: Registration = {
      id: confId,
      conferenceId: c.id,
      conferenceTitle: c.title,
      committeeId: selectedCommittee,
      committeeName: committee?.name || "",
      country: selectedCountry,
      status: "Confirmed",
      registeredAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      paid: true,
      amount: c.price,
    };

    addRegistration(registration);
    setLoading(false);
    setStep(4);
  };

  const isStep1Valid = fullName && school && phone;
  const isStep2Valid = selectedCommittee && selectedCountry;
  const isStep3Valid = cardNumber.replace(/\s/g, "").length === 16 && cardName && expiry.length === 5 && cvv.length >= 3;

  const STEPS = ["Delegate Info", "Committee", "Payment", "Confirmed"];

  return (
    <>
      <Navbar />
      <div
        className="min-h-screen pt-24 pb-16 px-6"
        style={{ background: "var(--bg-subtle)" }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href={`/conference/${c.id}`} className="text-sm mb-4 flex items-center gap-1" style={{ color: "var(--fg-muted)" }}>
              ← Back to {c.title}
            </Link>
            <h1 className="text-3xl font-black" style={{ color: "var(--fg)" }}>
              {step === 4 ? "🎉 Registration Confirmed!" : "Complete Registration"}
            </h1>
          </div>

          {/* Step Indicator */}
          {step < 4 && (
            <div className="flex items-center gap-0 mb-8">
              {STEPS.slice(0, 3).map((s, i) => {
                const stepNum = (i + 1) as Step;
                const done = step > stepNum;
                const active = step === stepNum;
                return (
                  <div key={s} className="flex items-center flex-1">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                        style={{
                          background: done ? "#16a34a" : active ? "var(--blue)" : "var(--border)",
                          color: done || active ? "white" : "var(--fg-muted)",
                        }}
                      >
                        {done ? "✓" : stepNum}
                      </div>
                      <span className="text-sm font-medium hidden sm:block" style={{ color: active ? "var(--fg)" : "var(--fg-muted)" }}>
                        {s}
                      </span>
                    </div>
                    {i < 2 && <div className="flex-1 h-0.5 mx-3" style={{ background: done ? "#16a34a" : "var(--border)" }} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Conference Summary Card */}
          {step < 4 && (
            <div
              className="p-5 rounded-2xl mb-6 flex items-center gap-4"
              style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white font-black text-xl">M</span>
              </div>
              <div className="flex-1">
                <p className="font-bold" style={{ color: "var(--fg)" }}>{c.title}</p>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{c.startDate} · {c.city}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: "var(--fg)" }}>{currencySymbol}{c.price}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Total</p>
              </div>
            </div>
          )}

          {/* Step 1: Delegate Info */}
          {step === 1 && (
            <div className="card p-8 rounded-2xl space-y-5">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Delegate Information</h2>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Full Name *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} className="input-base" placeholder="As it appears on your ID" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>School / University *</label>
                <input value={school} onChange={e => setSchool(e.target.value)} className="input-base" placeholder="Your school or university name" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Phone Number *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className="input-base" placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>MUN Experience Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {["beginner", "intermediate", "experienced"].map((exp) => (
                    <button
                      key={exp}
                      onClick={() => setExperience(exp)}
                      className="py-3 rounded-xl text-sm font-semibold capitalize transition-all border"
                      style={{
                        background: experience === exp ? "var(--blue-subtle)" : "var(--bg-subtle)",
                        color: experience === exp ? "var(--blue)" : "var(--fg-muted)",
                        borderColor: experience === exp ? "var(--blue)" : "var(--border)",
                      }}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
                className="btn btn-primary w-full"
                style={{ opacity: isStep1Valid ? 1 : 0.5, padding: "14px", borderRadius: "12px" }}
              >
                Continue to Committee Selection →
              </button>
            </div>
          )}

          {/* Step 2: Committee */}
          {step === 2 && (
            <div className="card p-8 rounded-2xl space-y-5">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Committee & Country Preference</h2>
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>Select Committee *</label>
                <div className="space-y-3">
                  {c.committees.map((cm) => (
                    <button
                      key={cm.id}
                      onClick={() => setSelectedCommittee(cm.id)}
                      className="w-full text-left p-4 rounded-xl border transition-all"
                      style={{
                        background: selectedCommittee === cm.id ? "var(--blue-subtle)" : "var(--bg-subtle)",
                        borderColor: selectedCommittee === cm.id ? "var(--blue)" : "var(--border)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm" style={{ color: "var(--fg)" }}>{cm.name}</span>
                        <span className="badge badge-blue">{cm.abbreviation}</span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{cm.topic1}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Country Preference *</label>
                <select
                  value={selectedCountry}
                  onChange={e => setSelectedCountry(e.target.value)}
                  className="input-base"
                >
                  <option value="">Select a country...</option>
                  {COUNTRIES.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
                <p className="text-xs mt-1.5" style={{ color: "var(--fg-muted)" }}>
                  Final assignment at organizer&apos;s discretion. We prioritize your preference.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn btn-ghost flex-1" style={{ padding: "14px" }}>← Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!isStep2Valid}
                  className="btn btn-primary flex-[2]"
                  style={{ opacity: isStep2Valid ? 1 : 0.5, padding: "14px", borderRadius: "12px" }}
                >
                  Continue to Payment →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div className="card p-8 rounded-2xl space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Payment Details</h2>
                <div className="flex gap-1.5 ml-auto">
                  {["VISA", "MC", "AMEX"].map(b => (
                    <span key={b} className="badge badge-gray text-[10px]">{b}</span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Card Number</label>
                <input
                  value={cardNumber}
                  onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                  className="input-base"
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Name on Card</label>
                <input value={cardName} onChange={e => setCardName(e.target.value)} className="input-base" placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Expiry Date</label>
                  <input
                    value={expiry}
                    onChange={e => setExpiry(formatExpiry(e.target.value))}
                    className="input-base"
                    placeholder="MM/YY"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>CVV</label>
                  <input
                    value={cvv}
                    onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="input-base"
                    placeholder="•••"
                    type="password"
                    maxLength={4}
                  />
                </div>
              </div>

              {/* Order summary */}
              <div
                className="rounded-xl p-4 space-y-2"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
              >
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Conference fee</span>
                  <span style={{ color: "var(--fg)" }}>{currencySymbol}{c.price}.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Processing fee</span>
                  <span style={{ color: "var(--fg)" }}>{currencySymbol}0.00</span>
                </div>
                <div className="flex justify-between font-bold" style={{ color: "var(--fg)", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                  <span>Total</span>
                  <span>{currencySymbol}{c.price}.00</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn btn-ghost flex-1" style={{ padding: "14px" }}>← Back</button>
                <button
                  onClick={handlePay}
                  disabled={!isStep3Valid || loading}
                  className="btn btn-primary flex-[2]"
                  style={{ opacity: isStep3Valid && !loading ? 1 : 0.5, padding: "14px", borderRadius: "12px" }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" style={{ animation: "spin 0.8s linear infinite" }} />
                      Processing...
                    </span>
                  ) : (
                    `🔒 Pay ${currencySymbol}${c.price}.00`
                  )}
                </button>
              </div>
              <p className="text-center text-xs" style={{ color: "var(--fg-muted)" }}>
                🔒 Secured with 256-bit SSL encryption. Your payment info is never stored.
              </p>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="card p-10 rounded-2xl text-center space-y-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-4xl"
                style={{ background: "#dcfce7" }}
              >
                ✅
              </div>
              <div>
                <h2 className="text-3xl font-black mb-2" style={{ color: "var(--fg)" }}>You&apos;re Registered!</h2>
                <p className="text-base" style={{ color: "var(--fg-muted)" }}>
                  Welcome to {c.title}. Check your dashboard for details.
                </p>
              </div>
              <div
                className="rounded-2xl p-5 text-left space-y-3"
                style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}
              >
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Confirmation ID</span>
                  <span className="font-mono font-bold" style={{ color: "var(--blue)" }}>{confirmationId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Delegate</span>
                  <span className="font-semibold" style={{ color: "var(--fg)" }}>{fullName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Committee</span>
                  <span className="font-semibold" style={{ color: "var(--fg)" }}>{committee?.abbreviation}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Country Preference</span>
                  <span className="font-semibold" style={{ color: "var(--fg)" }}>{selectedCountry}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Amount Paid</span>
                  <span className="font-bold" style={{ color: "#16a34a" }}>{currencySymbol}{c.price}.00</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/dashboard" className="btn btn-primary flex-1" style={{ padding: "14px", borderRadius: "12px" }}>
                  Go to Dashboard →
                </Link>
                <Link href="/marketplace" className="btn btn-ghost flex-1" style={{ padding: "14px" }}>
                  Browse More →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
