"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";
import { getCategoryStartingPrice, getActivePhase } from "@/lib/pricing";
import {
  getMarketplaceConferences,
  mapOrganizerConferenceToMarketplaceConference,
} from "@/lib/marketplace-conferences";

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

  const mergedConferences = useMemo(
    () => getMarketplaceConferences(organizerConferences),
    [organizerConferences]
  );
  const conference = mergedConferences.find((c) => c.id === params.id);
  const organizerConference = organizerConferences.find((event) => event.id === params.id);
  const acceptedPartnerConferences = useMemo(() => {
    if (!organizerConference) return [];
    const partnerIds = organizerConference.partnerConferenceIds || [];
    return organizerConferences.filter((entry) => partnerIds.includes(entry.id));
  }, [organizerConference, organizerConferences]);
  const mergedOrganizerConferences = useMemo(
    () => (organizerConference ? [organizerConference, ...acceptedPartnerConferences] : []),
    [organizerConference, acceptedPartnerConferences]
  );

  if (!conference && !organizerConference) {
    return (
      <div className="lux-shell lux-shell-immersive min-h-screen flex items-center justify-center">
        <div aria-hidden className="lux-backdrop" />
        <div className="relative text-center">
          <p
            className="lux-eyebrow justify-center inline-flex"
            style={{ color: "rgba(243,237,224,0.55)" }}
          >
            Not found
          </p>
          <h1
            className="mt-5 text-3xl font-semibold"
            style={{ color: "var(--fg-immersive)", letterSpacing: "-0.02em" }}
          >
            We couldn&apos;t find that conference.
          </h1>
          <Link
            href="/marketplace"
            className="lux-button-primary inline-block mt-8"
            style={{ padding: "12px 22px" }}
          >
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  const c =
    conference ||
    (organizerConference
      ? mapOrganizerConferenceToMarketplaceConference(organizerConference)
      : null);
  if (!c) return null;
  const derivedRegistered = organizerConference
    ? mergedOrganizerConferences.reduce((sum, entry) => sum + entry.applicants.length, 0)
    : c.registered;
  const derivedCapacity = organizerConference
    ? mergedOrganizerConferences.reduce((sum, entry) => sum + entry.capacity, 0)
    : c.capacity;
  const pct = Math.round((derivedRegistered / derivedCapacity) * 100);
  const seatsLeft = derivedCapacity - derivedRegistered;
  const currencySymbol = c.currency === "USD" ? "$" : c.currency === "EUR" ? "€" : c.currency === "GBP" ? "£" : "$";
  const mergedRegistrationCategories = organizerConference
    ? mergedOrganizerConferences.flatMap((entry) => entry.registrationCategories)
    : [];
  const mergedCommittees = organizerConference
    ? mergedOrganizerConferences.flatMap((entry) =>
        entry.committees
          .filter((committee) => committee.isPublic !== false)
          .map((committee) => ({
            ...committee,
            id: `${entry.id}:${committee.id}`,
            sourceConferenceTitle: entry.title,
            allotted: entry.applicants.filter(
              (applicant) => applicant.status === "Allotted" && applicant.assignedCommitteeId === committee.id
            ).length,
          }))
      )
    : [];
  const mergedReviews = organizerConference
    ? mergedOrganizerConferences.flatMap((entry) =>
        (entry.reviews || [])
          .filter((review) => review.status === "approved")
          .map((review) => ({ ...review, sourceConferenceTitle: entry.title }))
      )
    : [];
  const dynamicStartingPrice = organizerConference
    ? mergedRegistrationCategories.length > 0
      ? Math.min(
          ...mergedRegistrationCategories.map((category) =>
            getCategoryStartingPrice(
              category,
              mergedOrganizerConferences.flatMap((entry) => entry.committees)
            )
          )
        )
      : c.price
    : c.price;
  const activeCategoryPhase = organizerConference
    ? mergedRegistrationCategories
        .map((category) => getActivePhase(category.pricingPhases))
        .find(Boolean)
    : null;
  const displayTitle = organizerConference
    ? mergedOrganizerConferences.map((entry) => entry.title).join(" x ")
    : c.title;
  const displayOrganizerName = organizerConference
    ? mergedOrganizerConferences.map((entry) => entry.organizerName).join(" + ")
    : c.organizer;
  const displayDescription = organizerConference
    ? mergedOrganizerConferences
        .map((entry) => entry.description)
        .filter(Boolean)
        .join("\n\n")
    : c.description;
  const displayLocation = organizerConference
    ? mergedOrganizerConferences
        .map((entry) => entry.venue || `${entry.city}, ${entry.country}`)
        .join(" | ")
    : c.location;
  const displayOrganizerEmail = c.organizerEmail;
  const displayWebsite = organizerConference?.socialLinks?.website || c.website;
  const heroBannerImage = organizerConference?.bannerImageUrl || c.bannerImageUrl;
  const isOrganizerUser = isLoggedIn && user?.role === "organizer";
  const policySections = organizerConference
    ? [
        { key: "terms", label: "Terms and Conditions", value: organizerConference.termsAndConditions || "" },
        { key: "refund", label: "Refund / Cancellation Policy", value: organizerConference.refundPolicy || "" },
        { key: "conduct", label: "Code of Conduct", value: organizerConference.codeOfConduct || "" },
        { key: "faq", label: "FAQ / Additional Notes", value: organizerConference.faqNotes || "" },
      ].filter((entry) => entry.value.trim().length > 0)
    : [];
  const commonDocuments = organizerConference
    ? mergedOrganizerConferences.flatMap((entry) =>
        (entry.commonDocuments || []).map((document) => ({
          ...document,
          sourceConferenceTitle: entry.title,
        }))
      )
    : [];
  const committeeDocumentGroups = organizerConference
    ? mergedOrganizerConferences.flatMap((entry) =>
        entry.committees
          .filter((committee) => (committee.documents || []).length > 0)
          .map((committee) => ({
            id: `${entry.id}:${committee.id}`,
            committeeName: committee.name,
            sourceConferenceTitle: entry.title,
            documents: committee.documents || [],
          }))
      )
    : [];

  const handleRegister = () => {
    if (!isLoggedIn) { setAuthOpen(true); return; }
    if (isOrganizerUser) return;
    router.push(`/checkout/${c.id}`);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "committees", label: `Committees (${organizerConference ? mergedCommittees.length : c.committees.length})` },
    { key: "schedule", label: "Schedule" },
    { key: "organizer", label: "Organizer" },
    { key: "reviews", label: `Reviews (${organizerConference ? mergedReviews.length : 0})` },
  ];

  return (
    <div className="lux-shell lux-shell-immersive min-h-screen">
      <div aria-hidden className="lux-backdrop" />

      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Hero Banner */}
      <div
        className="pt-24 relative overflow-hidden"
        style={
          heroBannerImage
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(11,13,18,0.55) 0%, rgba(11,13,18,0.78) 65%, rgba(11,13,18,0.94) 100%), url("${heroBannerImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background:
                  "linear-gradient(180deg, rgba(11,13,18,0.4) 0%, rgba(11,13,18,0.85) 100%)",
              }
        }
      >
        <div className="max-w-7xl mx-auto px-6 py-20 pb-16 relative">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 text-xs tracking-[0.22em] uppercase mb-10"
            style={{ color: "rgba(243,237,224,0.55)" }}
          >
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span>·</span>
            <Link href="/marketplace" className="hover:text-white transition-colors">
              Marketplace
            </Link>
            <span>·</span>
            <span style={{ color: "var(--fg-immersive)" }}>{displayTitle}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-10">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-6">
                <span
                  className="text-[10px] font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: "rgba(243,237,224,0.1)",
                    color: "var(--fg-immersive)",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(243,237,224,0.18)",
                  }}
                >
                  {c.level}
                </span>
                {c.featured && (
                  <span
                    className="text-[10px] font-semibold px-3 py-1 rounded-full"
                    style={{
                      background:
                        "linear-gradient(120deg, #e7c390 0%, #d8ac72 55%, #b8925a 100%)",
                      color: "#1a1108",
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                    }}
                  >
                    Featured
                  </span>
                )}
                <span
                  className="text-[10px] font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: "rgba(243,237,224,0.1)",
                    color: "var(--fg-immersive)",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(243,237,224,0.18)",
                  }}
                >
                  {c.region}
                </span>
              </div>

              <h1
                className="lux-display max-w-3xl"
                style={{ color: "var(--fg-immersive)" }}
              >
                {displayTitle}
              </h1>

              {acceptedPartnerConferences.length > 0 && (
                <p
                  className="mt-5 text-sm"
                  style={{ color: "rgba(243,237,224,0.72)" }}
                >
                  Co-hosted by{" "}
                  {acceptedPartnerConferences.map((entry) => entry.title).join(", ")}
                </p>
              )}

              <div
                className="mt-8 flex flex-wrap gap-6 text-sm"
                style={{ color: "rgba(243,237,224,0.75)" }}
              >
                <span className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-warm)" }}>◆</span>
                  {displayLocation}
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-warm)" }}>◆</span>
                  {c.startDate} – {c.endDate}
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-warm)" }}>◆</span>
                  Deadline {c.registrationDeadline}
                </span>
              </div>
            </div>

            {/* Registration Card */}
            <div className="w-full lg:w-[340px] lux-card p-7 flex-shrink-0 lg:sticky lg:top-28">
              <p
                className="text-[10px] font-semibold"
                style={{
                  color: "rgba(243,237,224,0.55)",
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                }}
              >
                Starting from
              </p>
              <div className="flex items-baseline gap-2 mt-3">
                <span
                  className="text-4xl font-semibold"
                  style={{
                    color: "var(--fg-immersive)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {currencySymbol}
                  {dynamicStartingPrice}
                </span>
                <span className="text-xs" style={{ color: "rgba(243,237,224,0.55)" }}>
                  per delegate
                </span>
              </div>
              <p
                className="mt-2 text-xs"
                style={{ color: "rgba(243,237,224,0.55)" }}
              >
                {activeCategoryPhase
                  ? `${activeCategoryPhase.name} phase is active`
                  : "Base pricing currently active"}
              </p>

              <div className="lux-divider my-5" />

              <div className="space-y-4">
                <div className="lux-stat">
                  <span className="lux-stat-label">Seats</span>
                  <span className="lux-stat-value">
                    {seatsLeft}
                    <span
                      className="text-sm font-normal ml-1"
                      style={{ color: "rgba(243,237,224,0.55)" }}
                    >
                      / {derivedCapacity}
                    </span>
                  </span>
                </div>
                <div>
                  <div
                    className="flex justify-between text-[11px] mb-1.5"
                    style={{ color: "rgba(243,237,224,0.6)" }}
                  >
                    <span>{seatsLeft} remaining</span>
                    <span>{pct}% filled</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full"
                    style={{ background: "rgba(243,237,224,0.08)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background:
                          pct > 85
                            ? "linear-gradient(90deg, #f0a3a3, #dc6e6e)"
                            : pct > 65
                              ? "linear-gradient(90deg, #f3d8a8, #d8ac72)"
                              : "linear-gradient(90deg, #e7c390, #b8925a)",
                      }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRegister}
                className={isOrganizerUser ? "lux-button-ghost" : "lux-button-primary"}
                disabled={isOrganizerUser}
                style={{
                  width: "100%",
                  marginTop: "22px",
                  padding: "14px 18px",
                  fontSize: "14px",
                  cursor: isOrganizerUser ? "not-allowed" : "pointer",
                  opacity: isOrganizerUser ? 0.6 : 1,
                  ...(isOrganizerUser
                    ? {
                        color: "var(--fg-immersive)",
                        borderColor: "rgba(243,237,224,0.22)",
                        background: "rgba(243,237,224,0.04)",
                      }
                    : {}),
                }}
              >
                {isOrganizerUser
                  ? "Organizers cannot register"
                  : isLoggedIn
                    ? "Register now →"
                    : "Sign in to register →"}
              </button>

              <p
                className="mt-4 text-[11px] text-center"
                style={{ color: "rgba(243,237,224,0.5)" }}
              >
                Free cancellation before {c.registrationDeadline}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        className="sticky top-[72px] z-40"
        style={{
          background: "rgba(11,13,18,0.85)",
          backdropFilter: "blur(14px) saturate(118%)",
          WebkitBackdropFilter: "blur(14px) saturate(118%)",
          borderBottom: "1px solid rgba(243,237,224,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="whitespace-nowrap transition-colors"
                style={{
                  color:
                    tab === t.key
                      ? "var(--fg-immersive)"
                      : "rgba(243,237,224,0.55)",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  fontSize: "13px",
                  borderBottom:
                    tab === t.key
                      ? "2px solid var(--accent-warm)"
                      : "2px solid transparent",
                  borderRadius: 0,
                  padding: "14px 16px",
                  background: "transparent",
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
              {policySections.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Policies & Information</h2>
                  <div className="space-y-4">
                    {policySections.map((section) => (
                      <div key={section.key} className="card p-4 rounded-2xl">
                        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--fg)" }}>
                          {section.label}
                        </h3>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--fg-muted)" }}>
                          {section.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(commonDocuments.length > 0 || committeeDocumentGroups.length > 0) && (
                <div>
                  <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Documents</h2>
                  {commonDocuments.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Common MUN Documents</p>
                      {commonDocuments.map((document) => (
                        <a
                          key={`${document.sourceConferenceTitle}-${document.id}`}
                          className="card p-3 rounded-xl flex items-center justify-between gap-2"
                          href={document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div>
                            <p className="text-sm" style={{ color: "var(--fg)" }}>{document.title}</p>
                            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                              {document.category} · {document.sourceConferenceTitle}
                            </p>
                          </div>
                          <span className="text-xs" style={{ color: "var(--blue)" }}>Open</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {committeeDocumentGroups.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Committee Documents</p>
                      {committeeDocumentGroups.map((group) => (
                        <div key={group.id} className="card p-4 rounded-xl">
                          <p className="text-sm font-semibold mb-2" style={{ color: "var(--fg)" }}>
                            {group.committeeName}
                          </p>
                          <p className="text-xs mb-2" style={{ color: "var(--fg-muted)" }}>
                            {group.sourceConferenceTitle}
                          </p>
                          <div className="space-y-2">
                            {group.documents.map((document) => (
                              <a
                                key={document.id}
                                className="flex items-center justify-between gap-2"
                                href={document.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <span className="text-xs" style={{ color: "var(--fg)" }}>
                                  {document.title} · {document.category}
                                </span>
                                <span className="text-xs" style={{ color: "var(--blue)" }}>Open</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                  { label: "Committees", value: organizerConference ? mergedCommittees.length : c.committees.length },
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
              {(organizerConference
                ? mergedCommittees.map((cm) => ({
                    id: cm.id,
                    abbreviation: (cm.type || "Committee").slice(0, 8).toUpperCase(),
                    name: cm.name,
                    difficulty: "Intermediate" as const,
                    topic1: cm.agenda,
                    topic2: cm.customQuestions?.[0]?.question || "Details shared by organizer",
                    size: cm.seatCount,
                    seatsRemaining: cm.seatCount - cm.allotted,
                    portfolios: cm.portfolios ?? [],
                    chairName: cm.chairName,
                    sourceConferenceTitle: cm.sourceConferenceTitle,
                  }))
                : c.committees.map((cm) => ({
                    ...cm,
                    seatsRemaining: cm.size,
                    portfolios: [],
                    chairName: undefined,
                    sourceConferenceTitle: c.title,
                  }))
              ).map((cm) => (
                <div key={cm.id} className="card p-6 rounded-2xl">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="badge badge-blue mb-2">{cm.abbreviation}</span>
                      <h3 className="font-bold text-lg" style={{ color: "var(--fg)" }}>{cm.name}</h3>
                      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{cm.sourceConferenceTitle}</p>
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
            <p className="lux-eyebrow" style={{ color: "rgba(243,237,224,0.55)" }}>
              Programme
            </p>
            <h2
              className="lux-display mt-4 mb-10"
              style={{ color: "var(--fg-immersive)" }}
            >
              Conference schedule.
            </h2>
            <div className="space-y-5">
              {SCHEDULE.map((day) => (
                <div key={day.day} className="lux-card p-7">
                  <h3
                    className="text-lg font-semibold mb-5 flex items-center gap-4"
                    style={{ color: "var(--fg-immersive)" }}
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold"
                      style={{
                        background: "rgba(216,172,114,0.16)",
                        color: "var(--accent-warm)",
                      }}
                    >
                      {day.day.split(" ")[1]}
                    </span>
                    {day.day}
                  </h3>
                  <div className="space-y-3">
                    {day.events.map((event, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div
                          className="rounded-full mt-2 flex-shrink-0"
                          style={{
                            background: "var(--accent-warm)",
                            width: "6px",
                            height: "6px",
                          }}
                        />
                        <p
                          className="text-sm"
                          style={{ color: "rgba(243,237,224,0.72)" }}
                        >
                          {event}
                        </p>
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
                {(organizerConference ? mergedReviews : [])
                  .map((review) => (
                    <div key={review.id} className="card p-5 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{review.userName}</p>
                        <span className="badge badge-blue">{review.rating}/5</span>
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{review.sourceConferenceTitle}</p>
                      <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>{review.comment}</p>
                      {review.featured && <p className="text-xs mt-2" style={{ color: "var(--blue)" }}>Featured testimonial</p>}
                    </div>
                  ))}
                {(organizerConference ? mergedReviews : []).length === 0 && (
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
    </div>
  );
}
