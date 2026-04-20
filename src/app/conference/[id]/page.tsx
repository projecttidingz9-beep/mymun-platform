"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import { CONFERENCES } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { getCategoryStartingPrice, getActivePhase } from "@/lib/pricing";

type Tab = "overview" | "committees" | "schedule" | "organizer" | "reviews";

const SCHEDULE = [
  { day: "Day 1", events: ["09:00 — Opening Ceremony & Keynote", "11:00 — Committee Session I (General Speakers' List)", "14:00 — Lunch Break & Networking", "15:30 — Committee Session II (Moderated Caucus)", "19:00 — Welcome Reception & Gala Dinner"] },
  { day: "Day 2", events: ["09:00 — Committee Session III (Unmoderated Caucus)", "11:00 — Working Paper Presentations", "14:00 — Lunch & Country Block Meetings", "15:00 — Committee Session IV (Moderated Debate)", "18:00 — Position Paper Awards Ceremony"] },
  { day: "Day 3", events: ["09:00 — Committee Session V (Draft Resolution Debate)", "11:00 — Amendments & Final Speeches", "13:00 — Voting Procedure", "15:00 — Closing Ceremony & Awards", "17:00 — Farewell Reception"] },
];

export default function ConferenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, user, organizerConferences, addConferenceReview } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [authOpen, setAuthOpen] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({
    rating: 5,
    organizationRating: 5,
    committeeRating: 5,
    hospitalityRating: 5,
    comment: "",
  });

  const conference = CONFERENCES.find((c) => c.id === params.id);
  const organizerConference = organizerConferences.find((event) => event.id === params.id);

  if (!conference) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <p className="text-6xl mb-4">😕</p>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--fg)" }}>Conference Not Found</h1>
          <Link href="/marketplace" className="btn btn-primary mt-4">Back to Marketplace</Link>
        </div>
      </div>
    );
  }

  const c = conference;
  const derivedRegistered = organizerConference?.applicants.length ?? c.registered;
  const derivedCapacity = organizerConference?.capacity ?? c.capacity;
  const pct = Math.round((derivedRegistered / derivedCapacity) * 100);
  const seatsLeft = derivedCapacity - derivedRegistered;
  const currencySymbol = c.currency === "USD" ? "$" : c.currency === "EUR" ? "€" : c.currency === "GBP" ? "£" : "$";
  const dynamicStartingPrice = organizerConference
    ? organizerConference.registrationCategories.length > 0
      ? Math.min(
          ...organizerConference.registrationCategories.map((category) =>
            getCategoryStartingPrice(category, organizerConference.committees)
          )
        )
      : c.price
    : c.price;
  const activeCategoryPhase = organizerConference
    ? organizerConference.registrationCategories
        .map((category) => getActivePhase(category.pricingPhases))
        .find(Boolean)
    : null;
  const displayTitle = organizerConference?.title || c.title;
  const displayOrganizerName = organizerConference?.organizerName || c.organizer;
  const displayDescription = organizerConference?.description || c.description;
  const displayLocation = organizerConference?.venue || c.location;
  const displayOrganizerEmail = c.organizerEmail;
  const displayWebsite = organizerConference?.socialLinks?.website || c.website;
  const heroBannerImage = organizerConference?.bannerImageUrl || c.bannerImageUrl;

  const handleRegister = () => {
    if (!isLoggedIn) { setAuthOpen(true); return; }
    router.push(`/checkout/${c.id}`);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "committees", label: `Committees (${organizerConference?.committees.filter((entry) => entry.isPublic !== false).length || c.committees.length})` },
    { key: "schedule", label: "Schedule" },
    { key: "organizer", label: "Organizer" },
    { key: "reviews", label: `Reviews (${(organizerConference?.reviews || []).filter((entry) => entry.status === "approved").length})` },
  ];

  return (
    <>
      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Hero Banner */}
      <div
        className={`pt-20 ${heroBannerImage ? "" : `bg-gradient-to-br ${c.color}`} relative overflow-hidden`}
        style={
          heroBannerImage
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(2, 6, 23, 0.72), rgba(15, 23, 42, 0.6)), url("${heroBannerImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="max-w-7xl mx-auto px-6 py-16 pb-12 relative">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-white/60 text-sm mb-6">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
            <span>/</span>
            <span className="text-white">{displayTitle}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                  🎓 {c.level}
                </span>
                {c.featured && (
                  <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                    ⭐ Featured
                  </span>
                )}
                <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                  🌍 {c.region}
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                {displayTitle}
              </h1>

              <div className="flex flex-wrap gap-5 text-white/80 text-sm">
                <span className="flex items-center gap-2">📍 {displayLocation}</span>
                <span className="flex items-center gap-2">📅 {c.startDate} – {c.endDate}</span>
                <span className="flex items-center gap-2">⏰ Deadline: {c.registrationDeadline}</span>
              </div>
            </div>

            {/* Registration Card */}
            <div
              className="w-full lg:w-80 rounded-2xl p-6 flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(16px)",
                border: "1.5px solid rgba(255,255,255,0.25)",
              }}
            >
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black text-white">{currencySymbol}{dynamicStartingPrice}</span>
                <span className="text-white/60 text-sm">/ starts from</span>
              </div>
              <p className="text-white/60 text-xs mb-5">
                {activeCategoryPhase ? `${activeCategoryPhase.name} phase is active` : "Base pricing currently active"}
              </p>

              {/* Seats */}
              <div className="mb-4">
                <div className="flex justify-between text-white/70 text-xs mb-1.5">
                  <span>{seatsLeft} seats remaining</span>
                  <span>{pct}% filled</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: pct > 85 ? "#ef4444" : pct > 65 ? "#f59e0b" : "#22c55e",
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleRegister}
                className="btn w-full text-sm font-bold mb-3"
                style={{
                  background: "white",
                  color: "#1e40af",
                  padding: "14px",
                  borderRadius: "12px",
                }}
              >
                {isLoggedIn ? "Register Now →" : "Sign In to Register →"}
              </button>
              <p className="text-white/50 text-xs text-center">
                Free cancellation before {c.registrationDeadline}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        className="sticky top-[72px] z-40"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="tab whitespace-nowrap"
                style={{
                  color: tab === t.key ? "var(--blue)" : "var(--fg-muted)",
                  fontWeight: tab === t.key ? 700 : 500,
                  borderBottom: tab === t.key ? "2px solid var(--blue)" : "2px solid transparent",
                  borderRadius: 0,
                  padding: "12px 16px",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {tab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>About this Conference</h2>
                <p className="text-base leading-relaxed" style={{ color: "var(--fg-muted)" }}>{displayDescription}</p>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-5" style={{ color: "var(--fg)" }}>What&apos;s Included</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    "Committee participation & materials",
                    "Opening & closing ceremonies",
                    "Delegate documentation package",
                    "Access to all social events",
                    "Digital certificate of participation",
                    "Networking with global delegates",
                    "Expert speaker sessions",
                    "Best Delegate award consideration",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm" style={{ color: "var(--fg)" }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs" style={{ background: "#dcfce7", color: "#16a34a" }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {/* Stats card */}
              <div className="card p-6 rounded-2xl space-y-4">
                <h3 className="font-bold" style={{ color: "var(--fg)" }}>Conference Stats</h3>
                {[
                  { label: "Committees", value: organizerConference?.committees.filter((entry) => entry.isPublic !== false).length || c.committees.length },
                  { label: "Capacity", value: `${derivedCapacity} delegates` },
                  { label: "Registered", value: derivedRegistered },
                  { label: "Days", value: "3–4 days" },
                  { label: "Level", value: c.level },
                ].map((stat) => (
                  <div key={stat.label} className="flex justify-between items-center text-sm">
                    <span style={{ color: "var(--fg-muted)" }}>{stat.label}</span>
                    <span className="font-semibold" style={{ color: "var(--fg)" }}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div className="card p-5 rounded-2xl">
                <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--fg)" }}>Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {c.tags.map((tag) => (
                    <span key={tag} className="badge badge-blue">{tag}</span>
                  ))}
                </div>
              </div>
              {organizerConference && (organizerConference.previousEditions ?? []).length > 0 && (
                <div className="card p-5 rounded-2xl">
                  <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--fg)" }}>Previous Editions</h3>
                  <div className="space-y-2">
                    {(organizerConference.previousEditions ?? []).map((edition) => (
                      <p key={edition.id} className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        {edition.year}: {edition.title} ({edition.delegates} delegates)
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {organizerConference && (organizerConference.awards ?? []).length > 0 && (
                <div className="card p-5 rounded-2xl">
                  <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--fg)" }}>Awards</h3>
                  <div className="space-y-2">
                    {(organizerConference.awards ?? []).map((award) => (
                      <p key={award.id} className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        {award.category}: {award.prizeTitle || "Award"} {award.sponsorName ? `· Sponsored by ${award.sponsorName}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "committees" && (
          <div>
            <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--fg)" }}>Committees</h2>
            <div className="grid md:grid-cols-2 gap-5">
              {(organizerConference?.committees.filter((entry) => entry.isPublic !== false).map((cm) => {
                const allotted = organizerConference.applicants.filter(
                  (entry) => entry.status === "Allotted" && entry.assignedCommitteeId === cm.id
                ).length;
                const seatsRemaining = cm.seatCount - allotted;
                return {
                  id: cm.id,
                  abbreviation: (cm.type || "Committee").slice(0, 8).toUpperCase(),
                  name: cm.name,
                  difficulty: "Intermediate" as const,
                  topic1: cm.agenda,
                  topic2: cm.customQuestions?.[0]?.question || "Details shared by organizer",
                  size: cm.seatCount,
                  seatsRemaining,
                  portfolios: cm.portfolios ?? [],
                  chairName: cm.chairName,
                };
              }) ?? c.committees.map((cm) => ({ ...cm, seatsRemaining: cm.size, portfolios: [], chairName: undefined }))).map((cm) => (
                <div key={cm.id} className="card p-6 rounded-2xl">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="badge badge-blue mb-2">{cm.abbreviation}</span>
                      <h3 className="font-bold text-lg" style={{ color: "var(--fg)" }}>{cm.name}</h3>
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: cm.difficulty === "Advanced" ? "#fef2f2" : cm.difficulty === "Intermediate" ? "#fffbeb" : "#f0fdf4",
                        color: cm.difficulty === "Advanced" ? "#dc2626" : cm.difficulty === "Intermediate" ? "#d97706" : "#16a34a",
                      }}
                    >
                      {cm.difficulty}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--fg-muted)" }}>Topic 1</p>
                      <p className="text-sm" style={{ color: "var(--fg)" }}>{cm.topic1}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--fg-muted)" }}>Topic 2</p>
                      <p className="text-sm" style={{ color: "var(--fg)" }}>{cm.topic2}</p>
                    </div>
                    <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <span className="text-xs" style={{ color: "var(--fg-muted)" }}>Committee Size</span>
                      <span className="badge badge-gray">{cm.seatsRemaining}/{cm.size} seats left</span>
                    </div>
                    {(cm.portfolios ?? []).length > 0 && (
                      <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--fg-muted)" }}>
                          Seat Matrix
                        </p>
                        <div className="space-y-1">
                          {(cm.portfolios ?? []).map((portfolio) => {
                            const remaining = portfolio.seatCount - portfolio.assignedApplicantIds.length;
                            return (
                              <div key={portfolio.id} className="flex items-center justify-between text-xs">
                                <span style={{ color: "var(--fg-muted)" }}>{portfolio.name}</span>
                                <span style={{ color: remaining > 0 ? "#16a34a" : "#dc2626" }}>
                                  {remaining > 0 ? `${remaining} available` : "Filled"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "schedule" && (
          <div>
            <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--fg)" }}>Conference Schedule</h2>
            <div className="space-y-6">
              {SCHEDULE.map((day) => (
                <div key={day.day} className="card p-6 rounded-2xl">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-3" style={{ color: "var(--fg)" }}>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: "var(--blue-subtle)", color: "var(--blue)" }}>
                      {day.day.split(" ")[1]}
                    </span>
                    {day.day}
                  </h3>
                  <div className="space-y-3">
                    {day.events.map((event, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-1 h-1 rounded-full mt-2.5 flex-shrink-0" style={{ background: "var(--blue)", width: "6px", height: "6px" }} />
                        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{event}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "organizer" && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--fg)" }}>Meet the Organizer</h2>
            <div className="card p-8 rounded-2xl space-y-6">
              <div className="flex items-center gap-5">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
                  style={{ background: `linear-gradient(135deg, ${c.color.includes("blue") ? "#2563eb" : "#6d28d9"}, #60a5fa)` }}
                >
                  {displayOrganizerName[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: "var(--fg)" }}>{displayOrganizerName}</h3>
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Verified Conference Organizer</p>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => <span key={i} className="text-amber-400 text-sm">★</span>)}
                    <span className="text-xs ml-1" style={{ color: "var(--fg-muted)" }}>4.9/5 (120 reviews)</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>✉️</span>
                  <a href={`mailto:${displayOrganizerEmail}`} style={{ color: "var(--blue)" }}>{displayOrganizerEmail}</a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>🌐</span>
                  <a href={displayWebsite} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>{displayWebsite}</a>
                </div>
              </div>
              <button className="btn btn-ghost w-full">Contact Organizer</button>
            </div>
          </div>
        )}

        {tab === "reviews" && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Delegate Reviews</h2>
              <div className="space-y-3">
                {(organizerConference?.reviews || [])
                  .filter((entry) => entry.status === "approved")
                  .map((review) => (
                    <div key={review.id} className="card p-5 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{review.userName}</p>
                        <span className="badge badge-blue">{review.rating}/5</span>
                      </div>
                      <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>{review.comment}</p>
                      {review.featured && <p className="text-xs mt-2" style={{ color: "var(--blue)" }}>Featured testimonial</p>}
                    </div>
                  ))}
                {(organizerConference?.reviews || []).filter((entry) => entry.status === "approved").length === 0 && (
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No approved reviews yet.</p>
                )}
              </div>
            </div>
            <div className="card p-5 rounded-2xl h-fit">
              <h3 className="font-bold mb-3" style={{ color: "var(--fg)" }}>Share Your Experience</h3>
              <div className="space-y-2">
                <input className="input-base text-sm" type="number" min={1} max={5} value={reviewDraft.rating} onChange={(event) => setReviewDraft((prev) => ({ ...prev, rating: Number(event.target.value) }))} placeholder="Overall rating (1-5)" />
                <input className="input-base text-sm" type="number" min={1} max={5} value={reviewDraft.organizationRating} onChange={(event) => setReviewDraft((prev) => ({ ...prev, organizationRating: Number(event.target.value) }))} placeholder="Organization rating" />
                <input className="input-base text-sm" type="number" min={1} max={5} value={reviewDraft.committeeRating} onChange={(event) => setReviewDraft((prev) => ({ ...prev, committeeRating: Number(event.target.value) }))} placeholder="Committee rating" />
                <input className="input-base text-sm" type="number" min={1} max={5} value={reviewDraft.hospitalityRating} onChange={(event) => setReviewDraft((prev) => ({ ...prev, hospitalityRating: Number(event.target.value) }))} placeholder="Hospitality rating" />
                <textarea className="input-base text-sm" rows={4} value={reviewDraft.comment} onChange={(event) => setReviewDraft((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Write your review..." />
                <button
                  className="btn btn-primary w-full text-sm"
                  onClick={() => {
                    if (!isLoggedIn || !user) {
                      setAuthOpen(true);
                      return;
                    }
                    if (!reviewDraft.comment.trim()) return;
                    addConferenceReview(c.id, {
                      userId: user.id,
                      userName: user.name,
                      rating: reviewDraft.rating,
                      organizationRating: reviewDraft.organizationRating,
                      committeeRating: reviewDraft.committeeRating,
                      hospitalityRating: reviewDraft.hospitalityRating,
                      comment: reviewDraft.comment.trim(),
                    });
                    setReviewDraft({
                      rating: 5,
                      organizationRating: 5,
                      committeeRating: 5,
                      hospitalityRating: 5,
                      comment: "",
                    });
                  }}
                >
                  Submit Review
                </button>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Reviews are moderated before public display.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
