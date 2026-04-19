"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";

type WizardStep = 1 | 2 | 3 | 4 | 5;

const FEATURES_FOR_ORGANIZERS = [
  {
    icon: "📋",
    title: "Committee Builder",
    desc: "Create unlimited committees with custom topics, delegate caps, background guides, and difficulty ratings.",
  },
  {
    icon: "💳",
    title: "Automated Payments",
    desc: "Accept registrations and payments globally. Automated invoicing, refunds, and financial reporting built in.",
  },
  {
    icon: "📧",
    title: "Delegate Communication",
    desc: "Bulk email delegates, send schedule updates, share documents, and manage FAQs from one dashboard.",
  },
  {
    icon: "📊",
    title: "Analytics Dashboard",
    desc: "Real-time registration charts, geographic delegate maps, revenue tracking, and engagement metrics.",
  },
  {
    icon: "🔒",
    title: "Application Review",
    desc: "Streamlined application review with custom forms, position paper collection, and batch acceptance.",
  },
  {
    icon: "🏆",
    title: "Awards Management",
    desc: "Digital awards issuance, certificate generation, and best delegate tracking — no manual work.",
  },
];

const TIERS = [
  {
    name: "Starter",
    price: "Free",
    desc: "Perfect for first-time organizers",
    limit: "Up to 100 delegates",
    features: ["1 committee", "Basic registration form", "Email notifications", "Tidingz marketplace listing"],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Professional",
    price: "$49/mo",
    desc: "For established conferences",
    limit: "Up to 1,000 delegates",
    features: ["Unlimited committees", "Payment processing", "Analytics dashboard", "Position paper management", "Priority support"],
    cta: "Start 14-Day Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "For world-class conferences",
    limit: "Unlimited delegates",
    features: ["All Professional features", "Dedicated success manager", "Custom branding", "API access", "Bulk delegate import"],
    cta: "Contact Sales",
    highlight: false,
  },
];

const STEPS = ["Conference Details", "Committees", "Pricing & Dates", "Review & Submit"];

export default function OrganizersPage() {
  const router = useRouter();
  const { isLoggedIn, user, addOrganizerConference } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [confName, setConfName] = useState("");
  const [confCity, setConfCity] = useState("");
  const [confCountry, setConfCountry] = useState("");
  const [confDesc, setConfDesc] = useState("");
  const [confOrg, setConfOrg] = useState("");
  const [committees, setCommittees] = useState([{ name: "", topic: "", size: "" }]);
  const [regFee, setRegFee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [level, setLevel] = useState("High School");
  const [capacity, setCapacity] = useState("");

  const addCommittee = () => setCommittees(prev => [...prev, { name: "", topic: "", size: "" }]);
  const removeCommittee = (i: number) => setCommittees(prev => prev.filter((_, idx) => idx !== i));
  const updateCommittee = (i: number, field: string, val: string) =>
    setCommittees(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  const openWizard = () => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    setWizardOpen(true);
  };

  const openDashboard = () => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    router.push("/organizers/dashboard");
  };

  const handleSubmit = async () => {
    await new Promise(r => setTimeout(r, 1200));
    addOrganizerConference({
      title: confName,
      city: confCity,
      country: confCountry,
      organizerName: confOrg,
      level: level as "High School" | "University" | "Open",
      registrationFee: Number(regFee),
      capacity: Number(capacity),
      startDate,
      endDate,
      registrationDeadline: deadline,
      committees: committees
        .filter((committee) => committee.name && committee.topic)
        .map((committee, index) => ({
          id: `cm-${Date.now()}-${index}`,
          name: committee.name,
          topic: committee.topic,
          size: Number(committee.size) || 0,
        })),
    });
    setSubmitted(true);
  };

  const isStep1Valid = confName && confCity && confCountry && confOrg;
  const isStep2Valid = committees.some(c => c.name && c.topic);
  const isStep3Valid = regFee && startDate && endDate && capacity;

  return (
    <>
      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Hero */}
      <section
        className="pt-36 pb-24 px-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)", filter: "blur(40px)" }}
        />

        <div className="max-w-4xl mx-auto text-center relative">
          <span className="badge mb-6 mx-auto" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
            🏢 Conference Organizers
          </span>
          <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
            Run the world&apos;s next great{" "}
            <span style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              MUN Conference
            </span>
          </h1>
          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            From a 50-person school conference to 3,000-delegate world summits — Tidingz gives organizers the tools to create unforgettable MUN experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={openWizard}
              className="btn text-base font-bold px-8 py-4 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white",
                boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
                borderRadius: "16px",
              }}
            >
              🚀 Create Your Conference
            </button>
            <button
              onClick={openDashboard}
              className="btn text-base font-bold px-8 py-4"
              style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: "16px" }}
            >
              {isLoggedIn ? "Open Organizer Dashboard" : "Sign In to Dashboard"}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-8 justify-center mt-12 text-white/60 text-sm">
            {["Free to start", "No credit card needed", "Setup in 10 minutes"].map((point) => (
              <span key={point} className="flex items-center gap-2">
                <span className="text-green-400">✓</span> {point}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Create Conference Wizard */}
      {wizardOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div
            className="w-full max-w-2xl rounded-3xl overflow-hidden animate-fade-up"
            style={{ background: "var(--bg)", border: "1.5px solid var(--border)", boxShadow: "0 32px 80px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Header */}
            <div className="p-7 pb-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-2xl font-black" style={{ color: "var(--fg)" }}>
                  {submitted ? "🎉 Conference Submitted!" : `Create Conference — Step ${step} of 4`}
                </h2>
                {!submitted && (
                  <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{STEPS[step - 1]}</p>
                )}
              </div>
              <button onClick={() => { setWizardOpen(false); setSubmitted(false); setStep(1); }} style={{ color: "var(--fg-muted)", fontSize: "20px" }}>✕</button>
            </div>

            {/* Progress bar */}
            {!submitted && (
              <div className="px-7 py-3" style={{ background: "var(--bg-subtle)" }}>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex-1 h-1.5 rounded-full" style={{
                      background: s <= step ? "var(--blue)" : "var(--border)",
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div className="p-7">
              {submitted ? (
                <div className="text-center space-y-5 py-6">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-4xl" style={{ background: "#dcfce7" }}>✅</div>
                  <h3 className="text-2xl font-black" style={{ color: "var(--fg)" }}>{confName} is submitted!</h3>
                  <p style={{ color: "var(--fg-muted)" }}>
                    Our team will review your conference within 48 hours and publish it on the marketplace. You&apos;ll receive a confirmation email at the registered address.
                  </p>
                  {user && (
                    <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                      Saved to your organizer account: <strong>{user.email}</strong>
                    </p>
                  )}
                  <div className="rounded-2xl p-5 text-left space-y-2" style={{ background: "var(--bg-subtle)" }}>
                    <p className="text-sm"><strong>Conference:</strong> {confName}</p>
                    <p className="text-sm"><strong>Location:</strong> {confCity}, {confCountry}</p>
                    <p className="text-sm"><strong>Committees:</strong> {committees.filter(c => c.name).length}</p>
                    <p className="text-sm"><strong>Registration Fee:</strong> ${regFee}</p>
                  </div>
                  <button onClick={() => router.push("/organizers/dashboard")} className="btn btn-primary w-full">
                    Open Organizer Dashboard
                  </button>
                </div>
              ) : (
                <>
                  {/* Step 1: Conference Details */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Conference Name *</label>
                        <input value={confName} onChange={e => setConfName(e.target.value)} className="input-base" placeholder="e.g. Singapore International MUN" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>City *</label>
                          <input value={confCity} onChange={e => setConfCity(e.target.value)} className="input-base" placeholder="City" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Country *</label>
                          <input value={confCountry} onChange={e => setConfCountry(e.target.value)} className="input-base" placeholder="Country" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Organizing Body *</label>
                        <input value={confOrg} onChange={e => setConfOrg(e.target.value)} className="input-base" placeholder="e.g. School MUN Society" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Conference Level</label>
                        <div className="grid grid-cols-3 gap-2">
                          {["High School", "University", "Open"].map((l) => (
                            <button key={l} onClick={() => setLevel(l)} className="py-2.5 rounded-xl text-sm font-semibold transition-all border" style={{
                              background: level === l ? "var(--blue-subtle)" : "var(--bg-subtle)",
                              color: level === l ? "var(--blue)" : "var(--fg-muted)",
                              borderColor: level === l ? "var(--blue)" : "var(--border)",
                            }}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Brief Description</label>
                        <textarea value={confDesc} onChange={e => setConfDesc(e.target.value)} className="input-base" rows={3} placeholder="Describe your conference in 2-3 sentences..." style={{ resize: "none" }} />
                      </div>
                      <button onClick={() => setStep(2)} disabled={!isStep1Valid} className="btn btn-primary w-full" style={{ opacity: isStep1Valid ? 1 : 0.5 }}>
                        Next: Add Committees →
                      </button>
                    </div>
                  )}

                  {/* Step 2: Committees */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Add at least one committee with a topic.</p>
                      {committees.map((cm, i) => (
                        <div key={i} className="p-4 rounded-xl space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>Committee {i + 1}</span>
                            {i > 0 && <button onClick={() => removeCommittee(i)} className="text-xs" style={{ color: "#dc2626" }}>Remove</button>}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input value={cm.name} onChange={e => updateCommittee(i, "name", e.target.value)} className="input-base text-sm" placeholder="Committee name" />
                            <input value={cm.size} onChange={e => updateCommittee(i, "size", e.target.value)} className="input-base text-sm" placeholder="Max delegates" type="number" />
                          </div>
                          <input value={cm.topic} onChange={e => updateCommittee(i, "topic", e.target.value)} className="input-base text-sm" placeholder="Main topic of discussion" />
                        </div>
                      ))}
                      <button onClick={addCommittee} className="btn btn-ghost w-full text-sm" style={{ borderStyle: "dashed" }}>
                        + Add Another Committee
                      </button>
                      <div className="flex gap-3">
                        <button onClick={() => setStep(1)} className="btn btn-ghost flex-1">← Back</button>
                        <button onClick={() => setStep(3)} disabled={!isStep2Valid} className="btn btn-primary flex-[2]" style={{ opacity: isStep2Valid ? 1 : 0.5 }}>
                          Next: Pricing & Dates →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Pricing & Dates */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Registration Fee (USD) *</label>
                          <input value={regFee} onChange={e => setRegFee(e.target.value)} className="input-base" placeholder="e.g. 80" type="number" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Delegate Capacity *</label>
                          <input value={capacity} onChange={e => setCapacity(e.target.value)} className="input-base" placeholder="e.g. 300" type="number" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Start Date *</label>
                          <input value={startDate} onChange={e => setStartDate(e.target.value)} className="input-base" type="date" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>End Date *</label>
                          <input value={endDate} onChange={e => setEndDate(e.target.value)} className="input-base" type="date" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Registration Deadline</label>
                        <input value={deadline} onChange={e => setDeadline(e.target.value)} className="input-base" type="date" />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setStep(2)} className="btn btn-ghost flex-1">← Back</button>
                        <button onClick={() => setStep(4)} disabled={!isStep3Valid} className="btn btn-primary flex-[2]" style={{ opacity: isStep3Valid ? 1 : 0.5 }}>
                          Review & Submit →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Review */}
                  {step === 4 && (
                    <div className="space-y-5">
                      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                        {[
                          { label: "Conference", value: confName },
                          { label: "Location", value: `${confCity}, ${confCountry}` },
                          { label: "Organizer", value: confOrg },
                          { label: "Level", value: level },
                          { label: "Committees", value: committees.filter(c => c.name).map(c => c.name).join(", ") },
                          { label: "Fee", value: `$${regFee} USD` },
                          { label: "Capacity", value: `${capacity} delegates` },
                          { label: "Dates", value: `${startDate} to ${endDate}` },
                        ].map(r => (
                          <div key={r.label} className="flex justify-between text-sm">
                            <span style={{ color: "var(--fg-muted)" }}>{r.label}</span>
                            <span className="font-semibold text-right max-w-[240px]" style={{ color: "var(--fg)" }}>{r.value || "—"}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        By submitting, you agree to Tidingz&apos;s Organizer Terms. Your conference will be reviewed within 48 hours.
                      </p>
                      <div className="flex gap-3">
                        <button onClick={() => setStep(3)} className="btn btn-ghost flex-1">← Back</button>
                        <button onClick={handleSubmit} className="btn btn-primary flex-[2]">
                          🚀 Submit Conference
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Features */}
      <section className="py-24 px-6" style={{ background: "var(--bg)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mx-auto mb-4">Organizer Tools</div>
            <h2 className="text-4xl font-black" style={{ color: "var(--fg)" }}>
              Everything to run a <span className="text-gradient">world-class</span> conference
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES_FOR_ORGANIZERS.map((f, i) => (
              <div key={i} className="card p-7 rounded-2xl">
                <span className="text-3xl mb-5 block">{f.icon}</span>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--fg)" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6" style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mx-auto mb-4">Pricing</div>
            <h2 className="text-4xl font-black" style={{ color: "var(--fg)" }}>
              Simple, <span className="text-gradient">transparent</span> pricing
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="card p-8 rounded-2xl relative"
                style={{
                  border: tier.highlight ? "2px solid var(--blue)" : undefined,
                  boxShadow: tier.highlight ? "var(--card-shadow-hover)" : undefined,
                }}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge badge-blue text-[10px] px-3">Most Popular</span>
                  </div>
                )}
                <h3 className="font-bold text-lg mb-1" style={{ color: "var(--fg)" }}>{tier.name}</h3>
                <p className="text-3xl font-black my-3" style={{ color: "var(--fg)" }}>{tier.price}</p>
                <p className="text-xs mb-4" style={{ color: "var(--fg-muted)" }}>{tier.limit}</p>
                <div className="space-y-2 mb-6">
                  {tier.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--fg)" }}>
                      <span className="text-green-500">✓</span> {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => tier.name === "Enterprise" ? null : openWizard()}
                  className={`btn w-full text-sm ${tier.highlight ? "btn-primary" : "btn-ghost"}`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
