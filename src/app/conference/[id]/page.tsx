"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import type { Conference, PublicConferenceDetail } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { getCategoryStartingPrice, getActivePhase, getPhaseStatus } from "@/lib/pricing";
import { resolveConferenceBannerImage } from "@/lib/conference-media";
import { formatMoney } from "@/lib/format-money";
import {
  resolvePublishedConferenceDisplay,
} from "@/lib/public-conference-view";
import { hasOrganizerConferenceAccess } from "@/lib/organizer-access";
import AppRouteSkeleton from "@/components/AppRouteSkeleton";
import { CONFERENCES_PATH } from "@/lib/paths";

type Tab = "overview" | "committees" | "schedule" | "organizer" | "reviews";

const SCHEDULE = [
  { day: "Day 1", events: ["09:00 — Opening Ceremony & Keynote", "11:00 — Committee Session I (General Speakers' List)", "14:00 — Lunch Break & Networking", "15:30 — Committee Session II (Moderated Caucus)", "19:00 — Welcome Reception & Gala Dinner"] },
  { day: "Day 2", events: ["09:00 — Committee Session III (Unmoderated Caucus)", "11:00 — Working Paper Presentations", "14:00 — Lunch & Country Block Meetings", "15:00 — Committee Session IV (Moderated Debate)", "18:00 — Position Paper Awards Ceremony"] },
  { day: "Day 3", events: ["09:00 — Committee Session V (Draft Resolution Debate)", "11:00 — Amendments & Final Speeches", "13:00 — Voting Procedure", "15:00 — Closing Ceremony & Awards", "17:00 — Farewell Reception"] },
];
const DEFAULT_WHATS_INCLUDED = [
  "Committee participation & materials",
  "Opening & closing ceremonies",
  "Delegate documentation package",
  "Access to all social events",
  "Networking with global delegates",
  "Expert speaker sessions",
  "Best Delegate award consideration",
];

const DEFAULT_OVERVIEW_AWARDS = [
  "Best Delegate",
  "Outstanding Delegate",
  "Honorable Mention",
];

const DEFAULT_OVERVIEW_DOCUMENTS: { title: string; category: string; url: string }[] = [];

function ConferenceDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isLoggedIn,
    user,
    organizerConferences,
    addConferenceReview,
    updateOrganizerConferenceConfig,
    removeConferenceReview,
    lastOrganizerSyncError,
  } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [authOpen, setAuthOpen] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({
    rating: 5,
    comment: "",
  });
  const [addedTags, setAddedTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDeletingId, setReviewDeletingId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [instantReviews, setInstantReviews] = useState<
    Array<{ id: string; userName: string; rating: number; comment: string; sourceConferenceTitle: string; featured?: boolean }>
  >([]);

  const eventKey = String(params.id ?? "");
  const refreshNonce = searchParams.get("refresh") === "1" ? 1 : 0;
  const [catalogConference, setCatalogConference] = useState<Conference | null>(null);
  const [publicDetail, setPublicDetail] = useState<PublicConferenceDetail | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [publicFetchGeneration, setPublicFetchGeneration] = useState(0);

  const loadPublicConference = useCallback(async (signal?: AbortSignal) => {
    setCatalogLoading(true);
    try {
      const detailRes = await fetch(`/api/marketplace/${encodeURIComponent(eventKey)}`, {
        cache: "no-store",
        signal,
      });
      if (signal?.aborted) return;
      let detail: PublicConferenceDetail | null = null;
      if (detailRes.ok) {
        const detailData = (await detailRes.json()) as { conference?: PublicConferenceDetail };
        detail = detailData.conference ?? null;
      }
      if (signal?.aborted) return;
      setPublicDetail(detail);
      setCatalogConference(detail);
    } catch (error) {
      if (signal?.aborted) return;
      setCatalogConference(null);
      setPublicDetail(null);
    } finally {
      if (!signal?.aborted) {
        setCatalogLoading(false);
      }
    }
  }, [eventKey, refreshNonce]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPublicConference(controller.signal);
    return () => controller.abort();
  }, [eventKey, refreshNonce, publicFetchGeneration, loadPublicConference]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setPublicFetchGeneration((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const organizerConference = organizerConferences.find((event) => event.id === eventKey);
  const canPreviewUnpublishedConference = Boolean(
    organizerConference &&
      isLoggedIn &&
      (user?.role === "organizer" || user?.role === "admin") &&
      hasOrganizerConferenceAccess({ id: user?.id, email: user?.email }, organizerConference)
  );
  const acceptedPartnerConferences = (() => {
    if (!organizerConference) return [];
    const partnerIds = new Set([
      ...(organizerConference.partnerConferenceIds || []),
      ...(organizerConference.partnerLinks || [])
        .filter((link) => link.status === "ACCEPTED")
        .map((link) => link.partnerConferenceId),
    ]);
    return organizerConferences.filter((entry) => partnerIds.has(entry.id));
  })();
  const acceptedPartnerTitles = (() => {
    if (!organizerConference) return [];
    const fromConferences = acceptedPartnerConferences.map((entry) => entry.title);
    const fromLinks = (organizerConference.partnerLinks || [])
      .filter((link) => link.status === "ACCEPTED")
      .map((link) => link.partnerConferenceTitle || "Partner MUN")
      .filter(Boolean);
    return Array.from(new Set([...fromConferences, ...fromLinks]));
  })();
  const mergedOrganizerConferences = organizerConference
    ? [organizerConference, ...acceptedPartnerConferences]
    : [];

  const publicView = resolvePublishedConferenceDisplay({
    catalog: catalogConference,
    publicDetail,
    organizerConference,
    mergedOrganizerConferences,
    scheduleFallback: SCHEDULE,
  });
  const conference = publicView?.conference;
  const useServerPublicContent = publicView?.useServerPublicContent ?? false;
  const showOperationalOverlay = publicView?.hasOrganizerOperationalOverlay ?? false;

  if (organizerConference && organizerConference.status !== "Published" && !canPreviewUnpublishedConference) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="relative text-center">
          <p
            className="lux-eyebrow justify-center inline-flex"
            style={{ color: "var(--fg-muted)" }}
          >
            Not found
          </p>
          <h1
            className="mt-5 text-3xl font-semibold"
            style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}
          >
            We couldn&apos;t find that conference.
          </h1>
          <Link
            href={CONFERENCES_PATH}
            className="lux-button-primary inline-block mt-8"
            style={{ padding: "12px 22px" }}
          >
            Back to conferences
          </Link>
        </div>
      </div>
    );
  }

  const waitingForPublishedCatalog =
    (organizerConference?.status === "Published" || Boolean(publicDetail)) && catalogLoading && !conference;

  if ((!organizerConference && catalogLoading) || waitingForPublishedCatalog) {
    return <AppRouteSkeleton />;
  }

  if (!conference || !publicView) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="relative text-center">
          <p
            className="lux-eyebrow justify-center inline-flex"
            style={{ color: "var(--fg-muted)" }}
          >
            Not found
          </p>
          <h1
            className="mt-5 text-3xl font-semibold"
            style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}
          >
            We couldn&apos;t find that conference.
          </h1>
          <Link
            href={CONFERENCES_PATH}
            className="lux-button-primary inline-block mt-8"
            style={{ padding: "12px 22px" }}
          >
            Back to conferences
          </Link>
        </div>
      </div>
    );
  }

  const c = conference;
  const derivedRegistered = organizerConference
    ? mergedOrganizerConferences.reduce((sum, entry) => sum + entry.applicants.length, 0)
    : c.registered;
  const derivedCapacity = organizerConference
    ? mergedOrganizerConferences.reduce((sum, entry) => sum + entry.capacity, 0)
    : c.capacity;
  const seatsLeft = derivedCapacity - derivedRegistered;
  const publicPartnerConferences = publicDetail?.partnerConferences ?? [];
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
  const mergedReviews = showOperationalOverlay
    ? mergedOrganizerConferences.flatMap((entry) =>
        (entry.reviews || [])
          .filter((review) => review.status === "approved")
          .map((review) => ({ ...review, sourceConferenceTitle: entry.title }))
      )
    : (publicDetail?.reviews || []).map((review) => ({
        ...review,
        sourceConferenceTitle: c.title,
      }));
  const dynamicStartingPrice = showOperationalOverlay
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
  const activeCategoryPhase = showOperationalOverlay
    ? mergedRegistrationCategories
        .map((category) => getActivePhase(category.pricingPhases))
        .find(Boolean)
    : publicDetail?.activePricingPhaseName
      ? { name: publicDetail.activePricingPhaseName }
      : null;
  const phaseStatusChips = showOperationalOverlay
    ? mergedRegistrationCategories.flatMap((category) =>
        category.pricingPhases.map((phase) => ({
          id: `${category.id}-${phase.id}`,
          name: phase.name,
          status: getPhaseStatus(phase, new Date()),
        }))
      )
    : publicDetail?.pricingPhaseChips ?? [];
  const hiddenSections = new Set(
    showOperationalOverlay
      ? organizerConference?.hiddenSections || []
      : publicDetail?.hiddenSections || []
  );
  const isSectionVisible = (key: string) => !hiddenSections.has(key);
  const publicTeamMembers =
    (showOperationalOverlay ? organizerConference?.organizerTeam : publicDetail?.organizerTeam) || [];
  const displayTitle = publicView.displayTitle;
  const displayOrganizerName = publicView.displayOrganizerName;
  const safeDisplayDescription = publicView.safeDisplayDescription;
  const displayLocation = publicView.displayLocation;
  const displayOrganizerEmail = c.organizerEmail;
  const displayWebsite = publicView.displayWebsite;
  const displayInstagram = publicView.displayInstagram;
  const displayLinkedin = publicView.displayLinkedin;
  const displayTwitter = publicView.displayTwitter;
  const editableTags = Array.from(new Set([...publicView.displayTags, ...addedTags]));
  const heroBannerImage = resolveConferenceBannerImage({
    conference: c,
    organizerConference: useServerPublicContent ? undefined : organizerConference,
  });
  const heroLogoImage = publicView.heroLogoImage;
  const heroLogoFallback = displayTitle
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "MUN";
  const isOrganizerUser = isLoggedIn && user?.role === "organizer";
  const registrationIsOpen = showOperationalOverlay
    ? mergedRegistrationCategories.some(
        (category) => category.isOpen !== false && Boolean(getActivePhase(category.pricingPhases))
      )
    : publicDetail?.registrationOpen ?? true;
  const conferenceEnded = new Date(c.endDate).setHours(23, 59, 59, 999) < Date.now();
  const policySections = publicView.policySections;
  const commonDocuments = publicView.commonDocuments;
  const committeeDocumentGroups = showOperationalOverlay
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
    : c.committees
        .filter((committee) => (committee.documents || []).length > 0)
        .map((committee) => ({
          id: committee.id,
          committeeName: committee.name,
          sourceConferenceTitle: c.title,
          documents: committee.documents || [],
        }));
  const fallbackOverviewAwards =
    publicView.overviewAwardLines.length > 0
      ? publicView.overviewAwardLines
      : DEFAULT_OVERVIEW_AWARDS;
  const displayPreviousEditions = publicView.previousEditions;
  const fallbackOverviewDocuments = (
    commonDocuments.length > 0
      ? commonDocuments
      : DEFAULT_OVERVIEW_DOCUMENTS.map((document, index) => ({
          id: `default-doc-${index}`,
          sourceConferenceTitle: displayTitle,
          ...document,
        }))
  ).filter((document) => {
    const url = "url" in document ? String(document.url || "").trim() : "";
    return url.length > 0 && url !== "#";
  });
  const displayWhatsIncluded =
    publicView.displayWhatsIncluded.length > 0 ? publicView.displayWhatsIncluded : DEFAULT_WHATS_INCLUDED;
  const scheduleGroups =
    publicView.scheduleGroups.length > 0 ? publicView.scheduleGroups : SCHEDULE;

  const defaultStats: Record<string, string | number> = {
    Committees: showOperationalOverlay ? mergedCommittees.length : c.committees.length,
    Capacity: `${derivedCapacity} delegates`,
    Registered: derivedRegistered,
    Days: "3-4 days",
    Level: c.level,
  };

  const displayCommittees = showOperationalOverlay
    ? mergedCommittees.map((cm) => ({
        id: cm.id,
        abbreviation: (cm.type || "Committee").slice(0, 8).toUpperCase(),
        name: cm.name,
        difficulty: "Intermediate" as const,
        agendas: [cm.agenda, ...(cm.additionalAgendas || [])].filter(
          (agenda) => agenda.trim().length > 0
        ),
        size: cm.seatCount,
        seatsRemaining: cm.seatCount - cm.allotted,
        portfolios: cm.portfolios ?? [],
        chairName: cm.chairName,
        chairs: cm.chairs ?? [],
        noPortfolio: cm.noPortfolio,
        portfolioMatrixVisibility: organizerConference?.portfolioMatrixVisibility,
        logoImageUrl: cm.logoImageUrl,
        sourceConferenceTitle: cm.sourceConferenceTitle,
        documents: cm.documents || [],
      }))
    : c.committees.map((cm) => ({
        ...cm,
        agendas: (cm.agendas && cm.agendas.length > 0 ? cm.agendas : [cm.topic1, cm.topic2]).filter(
          (agenda) => agenda.trim().length > 0
        ),
        seatsRemaining: Math.max(cm.size - (cm.allottedCount ?? 0), 0),
        portfolios: (cm.portfolios ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          seatCount: p.seatCount,
          assignedApplicantIds: p.taken ? [p.name] : [],
        })),
        chairName: undefined,
        chairs: cm.chairs ?? [],
        noPortfolio: cm.noPortfolio,
        portfolioMatrixVisibility: cm.portfolioMatrixVisibility,
        logoImageUrl: cm.logoImageUrl,
        sourceConferenceTitle: c.title,
        documents: cm.documents ?? [],
      }));
  const localPendingReviews = showOperationalOverlay
    ? (organizerConference?.reviews || []).filter((review) => review.status === "pending")
    : [];
  const reviewsToShow = showOperationalOverlay
    ? [...instantReviews, ...localPendingReviews, ...mergedReviews]
    : [...mergedReviews, ...instantReviews];
  // Portfolio Matrix: real country/portfolio names, never "Seat N"/"Member N" placeholders.
  // Press Corps / no-portfolio committees are intentionally excluded — delegates there are
  // selected directly into the committee, not into a named portfolio slot.
  const portfolioMatrixShowsStatus = (committee: { portfolioMatrixVisibility?: "PUBLIC" | "PRIVATE" }) =>
    !showOperationalOverlay ? committee.portfolioMatrixVisibility === "PUBLIC" : true;
  // Keeps 1:1 index alignment with `displayCommittees` — noPortfolio (Press Corps style)
  // committees simply contribute an empty list instead of being spliced out.
  const portfolioMatrix = displayCommittees.map((committee) => {
    if (committee.noPortfolio) return [];
    const showStatus = portfolioMatrixShowsStatus(committee);
    return (committee.portfolios || []).flatMap((portfolio) => {
      const totalSeats = Math.max(1, portfolio.seatCount || 1);
      const availableSeats = Math.max(0, totalSeats - (portfolio.assignedApplicantIds?.length || 0));
      return Array.from({ length: totalSeats }).map((_, seatIndex) => ({
        label: totalSeats > 1 ? `${portfolio.name} ${seatIndex + 1}` : portfolio.name,
        available: seatIndex < availableSeats,
        showStatus,
      }));
    });
  });
  const countryMatrix = portfolioMatrix;

  const handleRegister = () => {
    if (!registrationIsOpen) return;
    if (!isLoggedIn) { setAuthOpen(true); return; }
    if (isOrganizerUser) return;
    router.push(`/checkout/${c.id}`);
  };

  const saveOverviewMeta = () => {
    // Ownership is re-checked here (not just `isOrganizerUser`) since `organizerConference` is
    // resolved from the signed-in organizer's own conference list — a foreign conference will
    // never appear there, so this can never target another organizer's data. Capacity/level are
    // configured from the organizer dashboard, not this public page — only tags are editable here.
    if (!organizerConference || !isOrganizerUser) return;
    updateOrganizerConferenceConfig(organizerConference.id, {
      tags: editableTags,
    });
    setReviewMessage("Tags saved.");
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("Conference link copied.");
      window.setTimeout(() => setShareMessage(null), 1800);
    } catch {
      setShareMessage("Could not copy link. Please copy the URL manually.");
    }
  };

  const shareVia = (platform: "whatsapp" | "twitter" | "instagram") => {
    const link = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Register for ${displayTitle}: ${window.location.href}`);
    if (platform === "whatsapp") window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    if (platform === "twitter") window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
    if (platform === "instagram") {
      void copyShareLink();
      window.open(`https://www.instagram.com/`, "_blank", "noopener,noreferrer");
    }
    if (!link) return;
  };

  const removeOwnReview = async (reviewId: string) => {
    if (!organizerConference || !user?.id || reviewDeletingId) return;
    setReviewDeletingId(reviewId);
    try {
      removeConferenceReview(organizerConference.id, reviewId, user.id);
      setReviewMessage("Review removed.");
    } finally {
      setReviewDeletingId(null);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "committees", label: `Committees (${showOperationalOverlay ? mergedCommittees.length : c.committees.length})` },
    ...(isSectionVisible("schedule") ? [{ key: "schedule" as const, label: "Schedule" }] : []),
    { key: "organizer", label: "Organizer" },
    { key: "reviews", label: `Reviews (${reviewsToShow.length})` },
  ];
  const publicAwards =
    (showOperationalOverlay ? organizerConference?.awards : publicDetail?.awards) || [];

  return (
    <div className="conference-detail-page min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>

      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {isOrganizerUser && lastOrganizerSyncError && (
        <div
          className="mx-auto max-w-5xl px-4 pt-4"
          role="status"
        >
          <p
            className="text-sm rounded-xl px-4 py-3"
            style={{
              color: "var(--danger-fg)",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
            }}
          >
            Your latest dashboard edits may not be on the public page yet: {lastOrganizerSyncError}
          </p>
        </div>
      )}

      <div className="conference-banner-shell pt-[calc(6rem+env(safe-area-inset-top,0px))]">
        <div className="max-w-7xl 2xl:max-w-[1320px] mx-auto px-4 sm:px-6 2xl:px-8 pt-4">
          <div className="conference-banner-frame relative flex flex-col justify-end min-h-[200px] md:aspect-[18/6] md:min-h-[260px]">
            {heroBannerImage ? (
              <Image
                src={heroBannerImage}
                alt={`${displayTitle} banner`}
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 1200px"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(120deg, color-mix(in srgb, var(--accent-warm) 28%, var(--bg) 72%), color-mix(in srgb, var(--blue) 24%, var(--bg) 76%))",
                }}
              />
            )}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(9,11,16,0.12) 0%, rgba(9,11,16,0.36) 58%, rgba(9,11,16,0.72) 100%)",
              }}
            />
            <div className="relative z-10 mt-auto p-4 sm:p-6 md:p-8 text-white">
              <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                <span className="badge" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>{c.level}</span>
                <span className="badge" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>{c.region}</span>
                {c.featured && <span className="badge" style={{ background: "rgba(231,195,144,0.95)", color: "#1a1108" }}>Featured</span>}
              </div>
              <h1 className="lux-display max-w-4xl" style={{ color: "#fff", fontSize: "clamp(1.5rem, 6vw, 4rem)" }}>
                {displayTitle}
              </h1>
              <div className="mt-3 sm:mt-4 grid sm:grid-cols-3 gap-2 sm:gap-3">
                <span className="conference-pill rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium">Place: {displayLocation}</span>
                <span className="conference-pill rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium">Dates: {c.startDate} - {c.endDate}</span>
                <span className="conference-pill rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium">Venue: {organizerConference?.venue || c.location}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl 2xl:max-w-[1320px] mx-auto px-4 sm:px-6 2xl:px-8 py-10 pb-24 relative">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 text-xs tracking-[0.22em] uppercase mb-10"
            style={{ color: "var(--fg-muted)" }}
          >
            <Link href="/" className="transition-colors">
              Home
            </Link>
            <span>·</span>
            <Link href={CONFERENCES_PATH} className="transition-colors">
              Conferences
            </Link>
            <span>·</span>
            <span style={{ color: "var(--fg)" }}>{displayTitle}</span>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px] gap-8 lg:gap-10 2xl:gap-12 items-stretch">
            <div className="order-2 lg:order-none flex-1 min-h-[420px] flex flex-col min-w-0">
              <h2 className="text-3xl font-semibold" style={{ color: "var(--fg)" }}>{displayTitle}</h2>
              <div className="mt-6 flex items-center gap-4">
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-black"
                  style={{
                    background: "color-mix(in srgb, var(--bg) 86%, transparent 14%)",
                    border: "2px solid var(--border)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                    color: "var(--fg)",
                  }}
                  aria-label={`${displayTitle} logo`}
                >
                  {heroLogoImage ? (
                    <Image
                      src={heroLogoImage}
                      alt={`${displayTitle} logo`}
                      width={112}
                      height={112}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span style={{ letterSpacing: "0.08em" }}>{heroLogoFallback}</span>
                  )}
                </div>
              </div>

              {acceptedPartnerTitles.length > 0 && (
                <p
                  className="mt-5 text-sm"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Co-hosted by{" "}
                  {acceptedPartnerTitles.join(", ")}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-outline-blue text-xs" onClick={() => setShareOpen(true)}>
                  Share Conference
                </button>
                {shareMessage && <span className="text-xs" style={{ color: "var(--success)" }}>{shareMessage}</span>}
              </div>
              <div className="mt-6 grid sm:grid-cols-2 gap-3 max-w-3xl">
                <div className="conference-surface rounded-xl px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--fg-muted)" }}>Organized by</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: "var(--fg)" }}>{displayOrganizerName}</p>
                </div>
              </div>
              <div className="hidden lg:block flex-1 min-h-[26px]" />
            </div>

            {/* Registration Card — first on mobile for faster primary action */}
            <div className="order-1 lg:order-none conference-hero-card w-full max-w-[420px] 2xl:max-w-[390px] mx-auto lg:mx-0 lux-card p-6 sm:p-7 flex-shrink-0 lg:sticky lg:top-[calc(6rem+env(safe-area-inset-top,0px))] 2xl:top-28 self-start lg:min-h-[420px] lg:flex lg:flex-col">
              <p
                className="text-xs sm:text-sm font-semibold"
                style={{
                  color: "var(--fg-muted)",
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                }}
              >
                {activeCategoryPhase?.name || "Registration"}
              </p>
              {activeCategoryPhase && (
                <p className="mt-2 text-sm sm:text-base font-semibold" style={{ color: "var(--blue)" }}>
                  {activeCategoryPhase.name} · Active
                </p>
              )}
              <div className="flex items-baseline gap-2 mt-3">
                <span
                  className="text-4xl font-semibold"
                  style={{
                    color: "var(--fg)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatMoney(dynamicStartingPrice, c.currency)}
                </span>
                <span className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {activeCategoryPhase ? `${activeCategoryPhase.name} pricing` : "per delegate"}
                </span>
              </div>
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--fg-muted)" }}
              >
                {activeCategoryPhase
                  ? `${activeCategoryPhase.name} phase is active`
                  : "Pricing details update from organizer dashboard"}
              </p>
              {phaseStatusChips.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs sm:text-sm font-medium" style={{ color: "var(--fg-muted)" }}>
                    Pricing phases
                  </p>
                  <div className="flex flex-col gap-2">
                    {phaseStatusChips.map((phase) => (
                      <div
                        key={phase.id}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="text-sm sm:text-base font-medium" style={{ color: "var(--fg)" }}>
                          {phase.name}
                        </span>
                        <span
                          className={`badge text-xs sm:text-sm ${phase.status === "Active" ? "badge-green" : phase.status === "Upcoming" ? "badge-blue" : "badge-gray"}`}
                        >
                          {phase.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="lux-divider my-5" />

              <div className="space-y-4">
                <div className="lux-stat">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--fg-muted)" }}>
                    Seats
                  </span>
                  <span className="text-[22px] font-semibold" style={{ color: "var(--fg)", letterSpacing: "-0.01em" }}>
                    {seatsLeft}
                    <span
                      className="text-sm font-normal ml-1"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      / {derivedCapacity}
                    </span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRegister}
                className={isOrganizerUser || !registrationIsOpen ? "lux-button-ghost" : "lux-button-primary"}
                disabled={isOrganizerUser || !registrationIsOpen}
                style={{
                  width: "100%",
                  marginTop: "22px",
                  padding: "14px 18px",
                  fontSize: "14px",
                  cursor: isOrganizerUser || !registrationIsOpen ? "not-allowed" : "pointer",
                  opacity: isOrganizerUser || !registrationIsOpen ? 0.6 : 1,
                  ...(isOrganizerUser || !registrationIsOpen
                    ? {
                        color: "var(--fg)",
                        borderColor: "var(--border)",
                        background: "var(--bg-subtle)",
                      }
                    : {}),
                }}
              >
                {isOrganizerUser
                  ? "Organizers cannot register"
                  : !registrationIsOpen
                    ? conferenceEnded
                      ? "Registrations Closed"
                      : "Coming Soon"
                    : isLoggedIn
                      ? "Register now →"
                      : "Sign in to register →"}
              </button>
              {!registrationIsOpen && !isOrganizerUser && (
                <p className="mt-2 text-[11px] text-center" style={{ color: "var(--fg-muted)" }}>
                  {conferenceEnded
                    ? "Registration for this conference has closed."
                    : "Check back once the organizer opens a registration phase."}
                </p>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        className="sticky top-[72px] z-40"
        style={{
          background: "color-mix(in srgb, var(--bg) 90%, transparent 10%)",
          backdropFilter: "blur(14px) saturate(118%)",
          WebkitBackdropFilter: "blur(14px) saturate(118%)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-7xl 2xl:max-w-[1320px] mx-auto px-4 sm:px-6 2xl:px-8">
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
                      ? "var(--fg)"
                      : "var(--fg-muted)",
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
      <div className="max-w-7xl 2xl:max-w-[1320px] mx-auto px-4 sm:px-6 2xl:px-8 py-12 relative z-10 isolate">
        {tab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <div className="lux-card p-6 sm:p-7">
                <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>
                  About this Conference
                </h2>
                <p className="text-base leading-relaxed" style={{ color: "var(--fg-muted)" }}>{safeDisplayDescription}</p>
              </div>
              {(fallbackOverviewDocuments.length > 0 || committeeDocumentGroups.length > 0) && (
              <div className="lux-card p-6 sm:p-7 space-y-6">
                <h2 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Documents</h2>
                {fallbackOverviewDocuments.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>Overview Documents</p>
                    <div
                      className="rounded-xl overflow-hidden divide-y"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      {fallbackOverviewDocuments.map((document) => (
                        <a
                          key={`${document.sourceConferenceTitle}-${document.id}`}
                          className="flex items-center justify-between gap-2 px-4 py-3"
                          style={{ color: "inherit" }}
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
                          <span className="text-xs shrink-0" style={{ color: "var(--blue)" }}>Open</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {committeeDocumentGroups.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>Committee Documents</p>
                      <div className="space-y-4">
                        {committeeDocumentGroups.map((group) => (
                          <div
                            key={group.id}
                            className="rounded-xl p-4"
                            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                          >
                            <p className="text-sm font-semibold mb-2" style={{ color: "var(--fg)" }}>
                              {group.committeeName}
                            </p>
                            <p className="text-xs mb-3" style={{ color: "var(--fg-muted)" }}>
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
                                  <span className="text-xs shrink-0" style={{ color: "var(--blue)" }}>Open</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                )}
              </div>
              )}
              {isSectionVisible("awards") && (
              <div className="lux-card p-6 sm:p-8">
                <h2 className="text-3xl font-bold mb-6" style={{ color: "var(--fg)" }}>Awards</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {publicAwards.length > 0
                    ? publicAwards.map((award) => (
                        <div
                          key={award.id}
                          className="rounded-2xl p-5 conference-surface"
                          style={{ border: "1px solid var(--border)" }}
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-muted)" }}>
                            {award.category}
                          </p>
                          <p className="text-xl font-bold mt-2" style={{ color: "var(--fg)" }}>
                            {award.prizeTitle || award.category}
                          </p>
                          {typeof award.amount === "number" && award.amount > 0 && (
                            <p className="text-base font-semibold mt-2" style={{ color: "var(--blue)" }}>
                              {formatMoney(award.amount, c.currency)}
                            </p>
                          )}
                          {("winnerName" in award ? award.winnerName : undefined) ||
                          award.participantName ? (
                            <p className="text-sm mt-3" style={{ color: "var(--fg-muted)" }}>
                              Winner:{" "}
                              <strong style={{ color: "var(--fg)" }}>
                                {("winnerName" in award ? award.winnerName : undefined) ||
                                  award.participantName}
                              </strong>
                            </p>
                          ) : null}
                          {award.description && (
                            <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>{award.description}</p>
                          )}
                        </div>
                      ))
                    : fallbackOverviewAwards.map((award) => (
                        <div key={award} className="rounded-2xl p-5 conference-surface">
                          <p className="text-lg font-semibold" style={{ color: "var(--fg)" }}>{award}</p>
                        </div>
                      ))}
                </div>
              </div>
              )}

              {isSectionVisible("whatsIncluded") && (
              <div className="lux-card p-6 sm:p-7">
                <h2 className="text-2xl font-bold mb-5" style={{ color: "var(--fg)" }}>What&apos;s Included</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {displayWhatsIncluded.map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm" style={{ color: "var(--fg)" }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs" style={{ background: "#dcfce7", color: "#16a34a" }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              )}
              {policySections.length > 0 && (
                <div className="lux-card p-6 sm:p-7">
                  <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Policies & Information</h2>
                  <div className="space-y-4">
                    {policySections.map((section) => (
                      <div
                        key={section.key}
                        className="rounded-2xl p-4 conference-surface"
                      >
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
              {(acceptedPartnerConferences.length > 0 || publicPartnerConferences.length > 0) && (
              <div className="lux-card p-6 sm:p-7">
                <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Partner MUN</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {acceptedPartnerConferences.length > 0
                    ? acceptedPartnerConferences.map((partner) => (
                        <div key={partner.id} className="conference-surface rounded-2xl p-4">
                          <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{partner.title}</p>
                          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{partner.city}, {partner.country}</p>
                        </div>
                      ))
                    : publicPartnerConferences.map((partner) => (
                        <div key={partner.id} className="conference-surface rounded-2xl p-4">
                          <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{partner.title}</p>
                        </div>
                      ))}
                </div>
              </div>
              )}
              {displayPreviousEditions.length > 0 && (
              <div className="lux-card p-6 sm:p-7">
                <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Previous Editions</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {displayPreviousEditions.map((edition) => (
                    <div key={edition.id} className="conference-surface rounded-2xl p-4">
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{edition.year} - {edition.title}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{edition.delegates} delegates</p>
                      {edition.highlights && <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{edition.highlights}</p>}
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>

            <div className="space-y-5">
              {/* Stats card — always read-only: every value here is computed/derived from actual
                  registration and configuration data, never a free-text field (prevents any
                  organizer, including one who doesn't own this conference, from typing in
                  fabricated numbers). */}
              <div className="card p-6 rounded-2xl space-y-4">
                <h3 className="font-bold" style={{ color: "var(--fg)" }}>Conference Stats</h3>
                {Object.entries(defaultStats).map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center text-sm gap-2">
                    <span style={{ color: "var(--fg-muted)" }}>{label}</span>
                    <span
                      className="text-sm font-semibold text-right"
                      style={{ color: "var(--fg)", minWidth: "130px" }}
                    >
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tags — editable only by the organizer who actually owns this conference
                  (gated on `organizerConference`, resolved from the actor's own conference
                  list, not merely on having an organizer account). */}
              <div className="card p-5 rounded-2xl">
                <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--fg)" }}>Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {editableTags.map((tag) => (
                    <span key={tag} className="badge badge-blue">{tag}</span>
                  ))}
                </div>
                {Boolean(organizerConference) && isOrganizerUser && (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input-base text-xs py-2"
                      value={tagDraft}
                      onChange={(event) => setTagDraft(event.target.value)}
                      placeholder="Add new tag"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-blue text-xs"
                      onClick={() => {
                        const nextTag = tagDraft.trim();
                        if (!nextTag) return;
                        if (editableTags.includes(nextTag)) return;
                        setAddedTags((prev) => [...prev, nextTag]);
                        setTagDraft("");
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
              {Boolean(organizerConference) && isOrganizerUser && (
                <button type="button" className="btn btn-primary text-xs w-full" onClick={saveOverviewMeta}>
                  Save tags
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "committees" && (
          <div>
            <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--fg)" }}>Committees</h2>
            {displayCommittees.length === 0 ? (
              <div className="lux-card p-8 text-center max-w-lg">
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  No committees are listed for this conference yet. Check back later or contact the organizer for the committee list.
                </p>
              </div>
            ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {displayCommittees.map((cm) => (
                <div key={cm.id} className="card p-6 rounded-2xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      {"logoImageUrl" in cm && cm.logoImageUrl ? (
                        <Image
                          src={cm.logoImageUrl}
                          alt={`${cm.name} logo`}
                          width={44}
                          height={44}
                          className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                          style={{ border: "1px solid var(--border)" }}
                          unoptimized
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{
                            background: "color-mix(in srgb, var(--bg) 86%, transparent 14%)",
                            border: "1px solid var(--border)",
                            color: "var(--fg-muted)",
                          }}
                          aria-hidden
                        >
                          {cm.abbreviation.slice(0, 3)}
                        </div>
                      )}
                      <div>
                        <span className="badge badge-blue mb-2">{cm.abbreviation}</span>
                        <h3 className="font-bold text-xl" style={{ color: "var(--fg)" }}>{cm.name}</h3>
                        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{cm.sourceConferenceTitle}</p>
                      </div>
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
                    {cm.agendas.map((agenda, index) => (
                      <div key={`${cm.id}-agenda-${index}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--fg-muted)" }}>
                          Topic {index + 1}
                        </p>
                        <p className="text-base leading-relaxed" style={{ color: "var(--fg)" }}>{agenda}</p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <span className="text-sm" style={{ color: "var(--fg-muted)" }}>Committee Size</span>
                      <span className="badge badge-gray">{cm.seatsRemaining}/{cm.size} seats left</span>
                    </div>
                    <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--fg-muted)" }}>
                        Documents
                      </p>
                      {(cm.documents || []).length > 0 ? (
                        <div className="space-y-1">
                          {(cm.documents || []).map((document) => (
                            <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="text-sm block" style={{ color: "var(--blue)" }}>
                              {document.title} · {document.category}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No committee documents uploaded yet.</p>
                      )}
                    </div>
                    <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--fg-muted)" }}>
                        Chairs
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {(
                          (cm as { chairs?: Array<{ id: string; name: string; role?: string; email?: string }> }).chairs?.length
                            ? (cm as { chairs: Array<{ id: string; name: string; role?: string; email?: string }> }).chairs
                            : cm.chairName
                              ? [{ id: `${cm.id}-chair`, name: cm.chairName, role: "Chair", email: undefined }]
                              : [{ id: `${cm.id}-chair-tba`, name: "Chairs to be announced", role: undefined, email: undefined }]
                        ).map((chair) => (
                          <div key={chair.id} className="conference-surface rounded-xl p-3">
                            <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{chair.name}</p>
                            {chair.role && <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>{chair.role}</p>}
                            {chair.email && <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>{chair.email}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4" style={{ color: "var(--fg)" }}>Portfolio Matrix</h3>
              <div className="space-y-4">
                {displayCommittees.map((committee, committeeIndex) => {
                  if (committee.noPortfolio) {
                    return (
                      <div key={`${committee.id}-matrix`} className="card p-5 rounded-2xl">
                        <p className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>{committee.name}</p>
                        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                          Delegates are selected directly into this committee — no named portfolios.
                        </p>
                      </div>
                    );
                  }
                  const seats = portfolioMatrix[committeeIndex] || [];
                  return (
                    <div key={`${committee.id}-matrix`} className="card p-5 rounded-2xl">
                      <p className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>{committee.name}</p>
                      {seats.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Portfolios will be announced soon.</p>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                          {seats.map((seat, seatIndex) => {
                            const showStatus = seat.showStatus;
                            const available = seat.available;
                            const style = showStatus
                              ? {
                                  background: available ? "rgba(22,163,74,0.14)" : "rgba(220,38,38,0.16)",
                                  color: available ? "#16a34a" : "#dc2626",
                                  border: `1px solid ${available ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)"}`,
                                }
                              : {
                                  background: "var(--bg-subtle)",
                                  color: "var(--fg)",
                                  border: "1px solid var(--border)",
                                };
                            return (
                              <span
                                key={`${committee.id}-seat-${seatIndex}`}
                                className="text-[10px] font-semibold rounded-md px-2 py-2 text-center"
                                style={style}
                              >
                                {seat.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {seats.length > 0 && !seats[0]?.showStatus && (
                        <p className="text-[11px] mt-2" style={{ color: "var(--fg-muted)" }}>
                          Allotment status is hidden by the organizer for this conference.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "schedule" && (
          <div>
            <div className="lux-card p-6 sm:p-7 mb-8">
              <p className="lux-eyebrow" style={{ color: "var(--fg-muted)" }}>
                Programme
              </p>
              <h2
                className="lux-display mt-4"
                style={{ color: "var(--fg)" }}
              >
                Conference schedule.
              </h2>
            </div>
            <div className="space-y-5">
              {scheduleGroups.map((day) => (
                <div key={day.day} className="lux-card p-7">
                  <h3
                    className="text-xl font-semibold mb-5 flex items-center gap-4"
                    style={{ color: "var(--fg)" }}
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold"
                      style={{
                        background: "rgba(96,165,250,0.16)",
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
                        <p className="text-base leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                          <span className="timing-pill mr-2">
                            {event.split("—")[0].trim()}
                          </span>
                          {event.split("—").slice(1).join("—").trim()}
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
          <div className="max-w-5xl">
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
                </div>
              </div>
              <div className="space-y-3">
                {displayOrganizerEmail && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>✉️</span>
                    <a href={`mailto:${displayOrganizerEmail}`} style={{ color: "var(--blue)" }}>{displayOrganizerEmail}</a>
                  </div>
                )}
                {displayWebsite && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>🌐</span>
                    <a href={displayWebsite} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>{displayWebsite}</a>
                  </div>
                )}
                {displayInstagram && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>📸</span>
                    <a href={displayInstagram} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>Instagram</a>
                  </div>
                )}
                {displayLinkedin && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>💼</span>
                    <a href={displayLinkedin} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>LinkedIn</a>
                  </div>
                )}
                {displayTwitter && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>𝕏</span>
                    <a href={displayTwitter} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>X / Twitter</a>
                  </div>
                )}
              </div>
              {publicTeamMembers.length > 0 && (
                <div className="space-y-7">
                  {(["organizer", "secretariat"] as const).map((teamType) => {
                    const members = publicTeamMembers.filter(
                      (member) => (member.teamType || "organizer") === teamType
                    );
                    if (members.length === 0) return null;
                    return (
                      <div key={teamType}>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--fg-muted)" }}>
                          {teamType === "secretariat" ? "Secretariat" : "Organizing Team"}
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {members.map((member) => (
                            <div key={member.id} className="rounded-2xl p-4 conference-surface flex flex-col items-center text-center gap-3">
                              {member.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={member.photoUrl}
                                  alt={member.name}
                                  className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
                                />
                              ) : (
                                <div
                                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                                  style={{ background: "linear-gradient(135deg, #2563eb, #60a5fa)" }}
                                >
                                  {member.name[0]?.toUpperCase() || "T"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-base font-bold" style={{ color: "var(--fg)" }}>{member.name}</p>
                                <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{member.role}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {displayOrganizerEmail && (
                <a href={`mailto:${displayOrganizerEmail}`} className="btn btn-ghost w-full">
                  Contact Organizer
                </a>
              )}
            </div>
          </div>
        )}

        {tab === "reviews" && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Delegate Reviews</h2>
              <div className="space-y-3">
                {reviewsToShow.map((review) => (
                    <div key={review.id} className="card p-5 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{review.userName}</p>
                        <div className="flex items-center gap-2">
                          <span className="badge badge-blue">{review.rating}/5</span>
                          {organizerConference && user?.id && "userId" in review && review.userId === user.id && (
                            <button
                              type="button"
                              className="btn btn-danger-ghost text-xs"
                              disabled={reviewDeletingId === review.id}
                              onClick={() => void removeOwnReview(review.id)}
                            >
                              {reviewDeletingId === review.id ? "Deleting…" : "Delete"}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                        {"sourceConferenceTitle" in review ? review.sourceConferenceTitle : displayTitle}
                      </p>
                      <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>{review.comment}</p>
                      {review.featured && <p className="text-xs mt-2" style={{ color: "var(--blue)" }}>Featured testimonial</p>}
                    </div>
                  ))}
                {reviewsToShow.length === 0 && (
                  <div className="lux-card p-8 text-center">
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>No approved reviews yet</p>
                    <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                      Be the first to share your experience after the conference.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="card p-5 rounded-2xl h-fit">
              <h3 className="font-bold mb-3" style={{ color: "var(--fg)" }}>Share Your Experience</h3>
              {conferenceEnded ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Overall rating (1-5)</label>
                <input className="input-base text-sm" type="number" min={1} max={5} value={reviewDraft.rating} onChange={(event) => setReviewDraft((prev) => ({ ...prev, rating: Number(event.target.value) }))} placeholder="Overall rating (1-5)" />
                <textarea className="input-base text-sm" rows={4} value={reviewDraft.comment} onChange={(event) => setReviewDraft((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Write your review..." />
                <button
                  className="btn btn-primary w-full text-sm"
                  disabled={reviewSubmitting}
                  onClick={async () => {
                    if (!isLoggedIn || !user) {
                      setAuthOpen(true);
                      return;
                    }
                    if (!reviewDraft.comment.trim()) {
                      setReviewMessage("Please write a review before submitting.");
                      return;
                    }
                    if (reviewSubmitting) return;
                    setReviewSubmitting(true);
                    const draftPayload = {
                      userId: user.id,
                      userName: user.name,
                      rating: reviewDraft.rating,
                      organizationRating: 5,
                      committeeRating: 5,
                      hospitalityRating: 5,
                      comment: reviewDraft.comment.trim(),
                    };
                    try {
                      const res = await fetch(`/api/marketplace/${c.id}/reviews`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          rating: draftPayload.rating,
                          comment: draftPayload.comment,
                        }),
                      });
                      const payload = (await res.json().catch(() => ({}))) as { error?: string };
                      if (!res.ok) {
                        setReviewMessage(payload.error ?? "Could not submit review.");
                        return;
                      }
                      if (organizerConference) {
                        addConferenceReview(c.id, draftPayload);
                      } else {
                        setInstantReviews((prev) => [
                          {
                            id: `instant-${Date.now()}`,
                            userName: draftPayload.userName,
                            rating: draftPayload.rating,
                            comment: draftPayload.comment,
                            sourceConferenceTitle: displayTitle,
                            featured: false,
                          },
                          ...prev,
                        ]);
                      }
                      setReviewMessage("Review submitted and pending moderation.");
                      setReviewDraft({
                        rating: 5,
                        comment: "",
                      });
                    } catch {
                      setReviewMessage("Could not submit review. Try again.");
                    } finally {
                      setReviewSubmitting(false);
                    }
                  }}
                >
                  {reviewSubmitting ? "Submitting…" : "Submit Review"}
                </button>
                {reviewMessage && <p className="text-xs" style={{ color: "var(--success)" }}>{reviewMessage}</p>}
              </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  Reviews can be submitted after the conference ends on {c.endDate}. Only registered delegates may leave a review.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
      {shareOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="card rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-base font-semibold" style={{ color: "var(--fg)" }}>Share conference</h3>
            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
              Share this registration link on social profiles.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-outline-blue text-xs" onClick={() => shareVia("whatsapp")}>WhatsApp</button>
              <button type="button" className="btn btn-outline-blue text-xs" onClick={() => shareVia("twitter")}>X / Twitter</button>
              <button type="button" className="btn btn-outline-blue text-xs" onClick={() => shareVia("instagram")}>Instagram</button>
              <button type="button" className="btn btn-primary text-xs" onClick={() => void copyShareLink()}>Copy Link</button>
            </div>
            <button type="button" className="btn btn-ghost text-xs w-full mt-3" onClick={() => setShareOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConferenceDetailPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <AppRouteSkeleton />
          <Footer />
        </>
      }
    >
      <ConferenceDetailPageContent />
    </Suspense>
  );
}
