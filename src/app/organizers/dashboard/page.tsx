"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import QrScannerPanel from "@/components/QrScannerPanel";
import { ensureServerSession } from "@/lib/client/session";
import { useAuth } from "@/lib/auth-context";
import { OrganizerConference } from "@/lib/types";
import { getActivePhase } from "@/lib/pricing";

const STATUS_STYLES: Record<OrganizerConference["status"], string> = {
  Draft: "badge-gray",
  Review: "badge-gold",
  Published: "badge-green",
};

const buildPreviewDraft = (conference?: OrganizerConference | null) => ({
  title: conference?.title || "",
  city: conference?.city || "",
  country: conference?.country || "",
  organizerName: conference?.organizerName || "",
  venue: conference?.venue || "",
  description: conference?.description || "",
  logoImageUrl: conference?.logoImageUrl || "",
  bannerImageUrl: conference?.bannerImageUrl || "",
  website: conference?.socialLinks?.website || "",
  instagram: conference?.socialLinks?.instagram || "",
  linkedin: conference?.socialLinks?.linkedin || "",
  twitter: conference?.socialLinks?.twitter || "",
  brandPrimaryColor: conference?.brandPrimaryColor || "#2563eb",
  brandSecondaryColor: conference?.brandSecondaryColor || "#60a5fa",
});

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const {
    user,
    isLoggedIn,
    organizerConferences,
    updateOrganizerConferenceStatus,
    updateApplicantStatus,
    toggleApplicantPayment,
    addAnnouncement,
    assignApplicant,
    moveApplicant,
    waitlistApplicant,
    inviteApplicant,
    unassignApplicant,
    overrideSeatLimit,
    updateOrganizerConferenceConfig,
    updateOrganizerCommitteeConfig,
    updateRegistrationCategoryConfig,
    addConferenceAward,
    removeConferenceAward,
    moderateConferenceReview,
  } = useAuth();

  const [selectedConferenceId, setSelectedConferenceId] = useState<string>("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [assignmentCommittee, setAssignmentCommittee] = useState<Record<string, string>>({});
  const [assignmentPortfolio, setAssignmentPortfolio] = useState<Record<string, string>>({});
  const [allowOverride, setAllowOverride] = useState<Record<string, boolean>>({});
  const [selectedApplicantId, setSelectedApplicantId] = useState<string>("");
  const [matrixOnlyAvailable, setMatrixOnlyAvailable] = useState(false);
  const [matrixCommitteeType, setMatrixCommitteeType] = useState("all");
  const [refundedApplicantIds, setRefundedApplicantIds] = useState<Record<string, boolean>>({});
  const [teamDraft, setTeamDraft] = useState({
    name: "",
    email: "",
    role: "USG" as "Lead Organizer" | "USG" | "Logistics Head" | "Committee Head",
  });
  const [editionDraft, setEditionDraft] = useState({
    year: "",
    title: "",
    delegates: "",
    highlights: "",
  });
  const [awardDraft, setAwardDraft] = useState({
    category: "",
    prizeTitle: "",
    sponsorName: "",
    sponsorLogoUrl: "",
    description: "",
  });
  const [serverOverview, setServerOverview] = useState<{
    totalRegistrations: number;
    acceptedDelegates: number;
    pendingApplications: number;
    waitlistedApplications: number;
    rejectedApplications: number;
    paymentCompletionRate: number;
    revenueCollected: number;
    applicationsTrend: Array<{ date: string; count: number }>;
  } | null>(null);
  const [previewDraft, setPreviewDraft] = useState(() =>
    buildPreviewDraft(organizerConferences[0] || null)
  );

  const syncAndIssuePass = async (conference: OrganizerConference, applicantId: string) => {
    const applicant = conference.applicants.find((entry) => entry.id === applicantId);
    if (!applicant || !applicant.registrationId) {
      alert("Applicant registration record is missing.");
      return;
    }

    const syncPayload = {
      registrationId: applicant.registrationId,
      eventId: conference.id,
      eventTitle: conference.title,
      eventStartDateIso: conference.startDate,
      eventEndDateIso: conference.endDate,
      userEmail: applicant.userEmail || `${applicant.id}@delegate.local`,
      userName: applicant.name,
      categoryName: applicant.categoryName || "Delegate Registration",
      committeeName: applicant.assignedCommitteeName || applicant.committeePreference || undefined,
      portfolioName: applicant.assignedPortfolioName || undefined,
      amount: applicant.amount || 0,
      paid: applicant.paid,
      organizerStatus: applicant.status,
    };

    await fetch("/api/registrations/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(syncPayload),
    });

    const issueResponse = await fetch("/api/passes/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        registrationId: applicant.registrationId,
        syncPayload,
      }),
    });
    const issueData = await issueResponse.json();
    if (!issueResponse.ok) {
      alert(issueData.error || "Failed to issue pass.");
      return;
    }
    alert(issueData.alreadyIssued ? "Pass already issued." : "Delegate pass issued successfully.");
  };

  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/organizers");
    }
  }, [isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    void ensureServerSession({
      email: user.email,
      role: "organizer",
      name: user.name,
    });
  }, [isLoggedIn, user]);

  const selectedConference = useMemo(() => {
    if (selectedConferenceId) {
      return organizerConferences.find((conference) => conference.id === selectedConferenceId);
    }
    return organizerConferences[0];
  }, [organizerConferences, selectedConferenceId]);

  useEffect(() => {
    if (!selectedConference) return;
    void fetch(`/api/organizers/conference-config/${selectedConference.id}`, { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.config) return;
        const cfg = data.config as Record<string, unknown>;
        setPreviewDraft((prev) => ({
          ...prev,
          title: String(cfg.title ?? prev.title),
          city: String(cfg.city ?? prev.city),
          country: String(cfg.country ?? prev.country),
          organizerName: String(cfg.organizerName ?? prev.organizerName),
          venue: String(cfg.venue ?? prev.venue),
          description: String(cfg.description ?? prev.description),
          logoImageUrl: String(cfg.logoImageUrl ?? prev.logoImageUrl),
          bannerImageUrl: String(cfg.bannerImageUrl ?? prev.bannerImageUrl),
          website: String((cfg.socialLinks as { website?: string } | undefined)?.website ?? prev.website),
          instagram: String((cfg.socialLinks as { instagram?: string } | undefined)?.instagram ?? prev.instagram),
          linkedin: String((cfg.socialLinks as { linkedin?: string } | undefined)?.linkedin ?? prev.linkedin),
          twitter: String((cfg.socialLinks as { twitter?: string } | undefined)?.twitter ?? prev.twitter),
          brandPrimaryColor: String(cfg.brandPrimaryColor ?? prev.brandPrimaryColor),
          brandSecondaryColor: String(cfg.brandSecondaryColor ?? prev.brandSecondaryColor),
        }));
      })
      .catch(() => null);
  }, [selectedConference]);

  useEffect(() => {
    if (!selectedConference) return;
    void fetch(`/api/organizers/overview/${selectedConference.id}`, { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setServerOverview(data.analytics || null))
      .catch(() => setServerOverview(null));
  }, [selectedConference]);

  const selectedConferenceAnalytics = useMemo(() => {
    if (!selectedConference) return null;
    const applicants = selectedConference.applicants;
    const paidCount = applicants.filter((entry) => entry.paid).length;
    const paymentCompletionRate = applicants.length === 0 ? 0 : Math.round((paidCount / applicants.length) * 100);

    const trendMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    for (const applicant of applicants) {
      const trendDate = applicant.registeredAt || "Unknown";
      trendMap.set(trendDate, (trendMap.get(trendDate) ?? 0) + 1);
      const country = applicant.countryPreference || "Unknown";
      countryMap.set(country, (countryMap.get(country) ?? 0) + 1);
      cityMap.set(selectedConference.city || "Unknown", (cityMap.get(selectedConference.city || "Unknown") ?? 0) + 1);
    }

    const committeeFill = selectedConference.committees.map((committee) => {
      const allotted = selectedConference.applicants.filter(
        (entry) => entry.status === "Allotted" && entry.assignedCommitteeId === committee.id
      ).length;
      const fillPercent = committee.seatCount > 0 ? Math.round((allotted / committee.seatCount) * 100) : 0;
      return { id: committee.id, name: committee.name, allotted, seatCount: committee.seatCount, fillPercent };
    });

    return {
      paymentCompletionRate,
      accepted: applicants.filter((entry) => entry.status === "Allotted").length,
      pending: applicants.filter((entry) => entry.status === "Pending").length,
      waitlisted: applicants.filter((entry) => entry.status === "Waitlisted").length,
      rejected: applicants.filter((entry) => entry.status === "Rejected").length,
      committeeFill,
      trend: Array.from(trendMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
      byCountry: Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      byCity: Array.from(cityMap.entries()).map(([city, count]) => ({ city, count })),
    };
  }, [selectedConference]);

  const selectedApplicant = useMemo(() => {
    if (!selectedConference || !selectedApplicantId) return null;
    return selectedConference.applicants.find((entry) => entry.id === selectedApplicantId) || null;
  }, [selectedConference, selectedApplicantId]);

  const delegationGroups = useMemo(() => {
    if (!selectedConference) return [];
    const groups = new Map<string, typeof selectedConference.applicants>();
    for (const applicant of selectedConference.applicants) {
      const groupKey = applicant.school || "Independent Delegates";
      const current = groups.get(groupKey) || [];
      current.push(applicant);
      groups.set(groupKey, current);
    }
    return Array.from(groups.entries())
      .map(([school, members]) => ({
        school,
        members,
        paidMembers: members.filter((entry) => entry.paid).length,
        assignedMembers: members.filter((entry) => entry.status === "Allotted").length,
      }))
      .sort((a, b) => b.members.length - a.members.length);
  }, [selectedConference]);

  const financeSummary = useMemo(() => {
    if (!selectedConference) return null;
    const entries = selectedConference.applicants;
    const gross = entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const successful = entries.filter((entry) => entry.paid && !refundedApplicantIds[entry.id]);
    const pending = entries.filter((entry) => !entry.paid).length;
    const refunds = entries.filter((entry) => refundedApplicantIds[entry.id]);
    const refundAmount = refunds.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    return {
      gross,
      successfulCount: successful.length,
      successfulAmount: successful.reduce((sum, entry) => sum + (entry.amount || 0), 0),
      pending,
      refundCount: refunds.length,
      refundAmount,
      netAfterFees: Math.round((gross - refundAmount) * 0.94),
    };
  }, [selectedConference, refundedApplicantIds]);

  if (!isLoggedIn || !user) return null;

  const totalApplicants = organizerConferences.reduce((acc, conference) => acc + conference.applicants.length, 0);
  const totalAccepted = organizerConferences.reduce(
    (acc, conference) => acc + conference.applicants.filter((applicant) => applicant.status === "Allotted").length,
    0
  );
  const totalRevenue = organizerConferences.reduce((acc, conference) => {
    const paidRevenue = conference.applicants
      .filter((applicant) => applicant.paid)
      .reduce((sum, applicant) => sum + ((applicant as { amount?: number }).amount ?? 0), 0);
    return acc + paidRevenue;
  }, 0);

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: "var(--bg-subtle)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="section-label mb-3">Organizer Control Center</div>
              <h1 className="text-4xl font-black" style={{ color: "var(--fg)" }}>
                {user.name.split(" ")[0]}&apos;s Organizer Dashboard
              </h1>
              <p className="text-base mt-1" style={{ color: "var(--fg-muted)" }}>
                Manage your conferences, delegate applications, and communications from one place.
              </p>
            </div>
            <Link href="/organizers" className="btn btn-primary text-sm">
              + Create New Conference
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Active Conferences", value: organizerConferences.length, icon: "🏛️", color: "#2563eb" },
              { label: "Total Applicants", value: totalApplicants, icon: "🧾", color: "#7c3aed" },
              { label: "Accepted Delegates", value: totalAccepted, icon: "✅", color: "#16a34a" },
              { label: "Collected Revenue", value: `$${totalRevenue}`, icon: "💰", color: "#d97706" },
            ].map((stat) => (
              <div key={stat.label} className="card p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{stat.icon}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: stat.color }} />
                </div>
                <p className="text-3xl font-black" style={{ color: "var(--fg)" }}>{stat.value}</p>
                <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {selectedConference && selectedConferenceAnalytics && (
            <div className="card p-6 rounded-2xl mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Dashboard Overview</h2>
                <span className="badge badge-blue">
                  {selectedConference.title} · API regs {serverOverview?.totalRegistrations ?? selectedConference.applicants.length}
                </span>
              </div>
              <div className="grid md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Accepted", value: selectedConferenceAnalytics.accepted },
                  { label: "Pending", value: selectedConferenceAnalytics.pending },
                  { label: "Waitlisted", value: selectedConferenceAnalytics.waitlisted },
                  { label: "Rejected", value: selectedConferenceAnalytics.rejected },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
                    <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{item.label}</p>
                    <p className="text-xl font-black" style={{ color: "var(--fg)" }}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="rounded-xl p-4" style={{ background: "var(--bg-subtle)" }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--fg)" }}>Committee fill %</p>
                  <div className="space-y-2">
                    {selectedConferenceAnalytics.committeeFill.map((entry) => (
                      <div key={entry.id}>
                        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--fg-muted)" }}>
                          <span>{entry.name}</span>
                          <span>{entry.fillPercent}%</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
                          <div className="h-2 rounded-full" style={{ width: `${entry.fillPercent}%`, background: "var(--blue)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: "var(--bg-subtle)" }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--fg)" }}>Top countries</p>
                  <div className="space-y-1">
                    {selectedConferenceAnalytics.byCountry.map((entry) => (
                      <div key={entry.country} className="flex justify-between text-xs" style={{ color: "var(--fg-muted)" }}>
                        <span>{entry.country}</span>
                        <span>{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: "var(--bg-subtle)" }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--fg)" }}>
                    Application trend · payment completion {selectedConferenceAnalytics.paymentCompletionRate}%
                  </p>
                  <div className="space-y-1">
                    {selectedConferenceAnalytics.trend.length === 0 && (
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No trend data yet.</p>
                    )}
                    {selectedConferenceAnalytics.trend.slice(-5).map((entry) => (
                      <div key={entry.date} className="flex justify-between text-xs" style={{ color: "var(--fg-muted)" }}>
                        <span>{entry.date}</span>
                        <span>{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Your Conferences</h2>
              {organizerConferences.map((conference) => (
                <button
                  key={conference.id}
                  onClick={() => {
                    setSelectedConferenceId(conference.id);
                    setPreviewDraft(buildPreviewDraft(conference));
                  }}
                  className="card p-5 rounded-2xl w-full text-left"
                  style={{
                    border: selectedConferenceId === conference.id ? "2px solid var(--blue)" : "1.5px solid var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm" style={{ color: "var(--fg)" }}>{conference.title}</h3>
                    <span className={`badge ${STATUS_STYLES[conference.status]}`}>{conference.status}</span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
                    {conference.city}, {conference.country} · {conference.level}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                    {conference.applicants.length} applicants · {conference.capacity} capacity
                  </p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-8 space-y-6">
              {!selectedConference ? (
                <div className="card p-8 rounded-2xl text-sm" style={{ color: "var(--fg-muted)" }}>
                  Select a conference to manage operations.
                </div>
              ) : (
                <>
                  <div className="card p-6 rounded-2xl">
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                      <h2 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
                        {selectedConference.title}
                      </h2>
                      <div className="flex gap-2">
                        {(["Draft", "Review", "Published"] as OrganizerConference["status"][]).map((status) => (
                          <button
                            key={status}
                            onClick={() => updateOrganizerConferenceStatus(selectedConference.id, status)}
                            className="btn btn-ghost text-xs"
                            style={{
                              background: selectedConference.status === status ? "var(--blue-subtle)" : "var(--bg-subtle)",
                              borderColor: selectedConference.status === status ? "var(--blue)" : "var(--border)",
                              color: selectedConference.status === status ? "var(--blue)" : "var(--fg-muted)",
                            }}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <p style={{ color: "var(--fg-muted)" }}><strong style={{ color: "var(--fg)" }}>Dates:</strong> {selectedConference.startDate} → {selectedConference.endDate}</p>
                      <p style={{ color: "var(--fg-muted)" }}>
                        <strong style={{ color: "var(--fg)" }}>Categories:</strong> {selectedConference.registrationCategories.length}
                      </p>
                      <p style={{ color: "var(--fg-muted)" }}><strong style={{ color: "var(--fg)" }}>Capacity:</strong> {selectedConference.capacity}</p>
                    </div>
                  </div>

                  <div className="card p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Conference Page Preview</h3>
                      <button
                        className="btn btn-primary text-xs"
                        onClick={async () => {
                          updateOrganizerConferenceConfig(selectedConference.id, {
                            title: previewDraft.title,
                            city: previewDraft.city,
                            country: previewDraft.country,
                            organizerName: previewDraft.organizerName,
                            venue: previewDraft.venue || undefined,
                            description: previewDraft.description || undefined,
                            logoImageUrl: previewDraft.logoImageUrl || undefined,
                            bannerImageUrl: previewDraft.bannerImageUrl || undefined,
                            socialLinks: {
                              website: previewDraft.website || undefined,
                              instagram: previewDraft.instagram || undefined,
                              linkedin: previewDraft.linkedin || undefined,
                              twitter: previewDraft.twitter || undefined,
                            },
                            brandPrimaryColor: previewDraft.brandPrimaryColor || undefined,
                            brandSecondaryColor: previewDraft.brandSecondaryColor || undefined,
                          });
                          await fetch(`/api/organizers/conference-config/${selectedConference.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify(previewDraft),
                          }).catch(() => null);
                        }}
                      >
                        Save Preview Settings
                      </button>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <input value={previewDraft.title} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, title: event.target.value }))} className="input-base text-sm" placeholder="Conference title" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={previewDraft.city} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, city: event.target.value }))} className="input-base text-sm" placeholder="City" />
                          <input value={previewDraft.country} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, country: event.target.value }))} className="input-base text-sm" placeholder="Country" />
                        </div>
                        <input value={previewDraft.organizerName} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, organizerName: event.target.value }))} className="input-base text-sm" placeholder="Organizer name" />
                        <input value={previewDraft.venue} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, venue: event.target.value }))} className="input-base text-sm" placeholder="Venue" />
                        <input value={previewDraft.logoImageUrl} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, logoImageUrl: event.target.value }))} className="input-base text-sm" placeholder="Logo URL" />
                        <input value={previewDraft.bannerImageUrl} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, bannerImageUrl: event.target.value }))} className="input-base text-sm" placeholder="Banner URL" />
                        <textarea value={previewDraft.description} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, description: event.target.value }))} className="input-base text-sm" rows={3} placeholder="Conference description" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={previewDraft.website} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, website: event.target.value }))} className="input-base text-sm" placeholder="Website URL" />
                          <input value={previewDraft.instagram} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, instagram: event.target.value }))} className="input-base text-sm" placeholder="Instagram URL" />
                          <input value={previewDraft.linkedin} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, linkedin: event.target.value }))} className="input-base text-sm" placeholder="LinkedIn URL" />
                          <input value={previewDraft.twitter} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, twitter: event.target.value }))} className="input-base text-sm" placeholder="X/Twitter URL" />
                        </div>
                      </div>
                      <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
                        <div
                          className="h-40 p-4 flex items-end"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${previewDraft.brandPrimaryColor}, ${previewDraft.brandSecondaryColor}), url("${previewDraft.bannerImageUrl}")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          <h4 className="text-white text-lg font-black">{previewDraft.title || "Conference Preview"}</h4>
                        </div>
                        <div className="p-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
                          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{previewDraft.city}, {previewDraft.country}</p>
                          <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{previewDraft.organizerName}</p>
                          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{previewDraft.description || "Description will appear here."}</p>
                          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Venue: {previewDraft.venue || "—"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Applications</h3>
                    <div className="grid md:grid-cols-5 gap-2 mb-4">
                      {(["Pending", "Invited", "Allotted", "Waitlisted", "Rejected"] as const).map((status) => {
                        const count = selectedConference.applicants.filter((entry) => entry.status === status).length;
                        return (
                          <div key={status} className="rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
                            <p className="text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>{status}</p>
                            <p className="text-lg font-black" style={{ color: "var(--fg)" }}>{count}</p>
                          </div>
                        );
                      })}
                    </div>
                    {selectedConference.applicants.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No applications yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedConference.applicants.map((applicant) => {
                          const suggestedCommittee = applicant.committeePreferences?.[0] || applicant.committeePreference;
                          const selectedCommitteeId = assignmentCommittee[applicant.id] || applicant.assignedCommitteeId || "";
                          const selectedCommittee = selectedConference.committees.find((committee) => committee.id === selectedCommitteeId);
                          const selectedPortfolioId = assignmentPortfolio[applicant.id] || applicant.assignedPortfolioId || "";

                          return (
                            <div
                              key={applicant.id}
                              className="p-4 rounded-xl"
                              style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}
                            >
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{applicant.name}</p>
                                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{applicant.school}</p>
                                  <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                                    Category: {applicant.categoryName || "N/A"} · Country: {applicant.countryPreference || "N/A"}
                                  </p>
                                  <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                                    Preferences: {(applicant.committeePreferences || [applicant.committeePreference]).filter(Boolean).join(" → ") || "Not provided"}
                                  </p>
                                  {suggestedCommittee && (
                                    <p className="text-xs mt-1" style={{ color: "var(--blue)" }}>
                                      Suggested allotment: {suggestedCommittee}
                                    </p>
                                  )}
                                </div>
                                <span className={`badge ${
                                  applicant.status === "Allotted"
                                    ? "badge-green"
                                    : applicant.status === "Rejected"
                                      ? "badge-gray"
                                      : applicant.status === "Waitlisted"
                                        ? "badge-gold"
                                    : applicant.status === "Invited"
                                        ? "badge-blue"
                                        : "badge-blue"
                                }`}>
                                  {applicant.status}
                                </span>
                              </div>

                              <div className="grid md:grid-cols-2 gap-2 mt-3">
                                <select
                                  className="input-base text-xs"
                                  value={selectedCommitteeId}
                                  onChange={(event) =>
                                    setAssignmentCommittee((prev) => ({ ...prev, [applicant.id]: event.target.value }))
                                  }
                                >
                                  <option value="">Select committee</option>
                                  {selectedConference.committees.map((committee) => {
                                    const filled = selectedConference.applicants.filter(
                                      (entry) => entry.status === "Allotted" && entry.assignedCommitteeId === committee.id
                                    ).length;
                                    const available = committee.seatCount - filled;
                                    return (
                                      <option key={committee.id} value={committee.id}>
                                        {committee.name} ({available}/{committee.seatCount} available)
                                      </option>
                                    );
                                  })}
                                </select>
                                <select
                                  className="input-base text-xs"
                                  value={selectedPortfolioId}
                                  onChange={(event) =>
                                    setAssignmentPortfolio((prev) => ({ ...prev, [applicant.id]: event.target.value }))
                                  }
                                  disabled={!selectedCommittee || (selectedCommittee.portfolios ?? []).length === 0}
                                >
                                  <option value="">Select portfolio (optional)</option>
                                  {(selectedCommittee?.portfolios ?? []).map((portfolio) => {
                                    const available = portfolio.seatCount - portfolio.assignedApplicantIds.length;
                                    return (
                                      <option key={portfolio.id} value={portfolio.id}>
                                        {portfolio.name} ({available}/{portfolio.seatCount} available)
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              <label className="flex items-center gap-2 mt-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(allowOverride[applicant.id])}
                                  onChange={(event) =>
                                    setAllowOverride((prev) => ({ ...prev, [applicant.id]: event.target.checked }))
                                  }
                                />
                                Allow seat override for this allocation
                              </label>

                              <div className="flex gap-2 mt-3 flex-wrap">
                                <button
                                  onClick={() => setSelectedApplicantId(applicant.id)}
                                  className="btn btn-ghost text-xs"
                                >
                                  Open Profile
                                </button>
                                <button
                                  onClick={() => {
                                    const result = inviteApplicant(selectedConference.id, applicant.id);
                                    if (!result.ok) alert(result.message);
                                  }}
                                  className="btn btn-ghost text-xs"
                                >
                                  Invite
                                </button>
                                <button
                                  onClick={() => {
                                    const result = assignApplicant({
                                      conferenceId: selectedConference.id,
                                      applicantId: applicant.id,
                                      committeeId: selectedCommitteeId,
                                      portfolioId: selectedPortfolioId || undefined,
                                      allowOverride: Boolean(allowOverride[applicant.id]),
                                    });
                                    if (!result.ok) alert(result.message);
                                  }}
                                  className="btn btn-primary text-xs"
                                  disabled={!selectedCommitteeId}
                                >
                                  Allot
                                </button>
                                <button
                                  onClick={() => {
                                    const result = moveApplicant({
                                      conferenceId: selectedConference.id,
                                      applicantId: applicant.id,
                                      committeeId: selectedCommitteeId,
                                      portfolioId: selectedPortfolioId || undefined,
                                      allowOverride: Boolean(allowOverride[applicant.id]),
                                    });
                                    if (!result.ok) alert(result.message);
                                  }}
                                  className="btn btn-ghost text-xs"
                                  disabled={!selectedCommitteeId}
                                >
                                  Move
                                </button>
                                <button
                                  onClick={() => {
                                    const result = waitlistApplicant(selectedConference.id, applicant.id);
                                    if (!result.ok) alert(result.message);
                                  }}
                                  className="btn btn-ghost text-xs"
                                >
                                  Waitlist
                                </button>
                                <button
                                  onClick={() => {
                                    const result = unassignApplicant(selectedConference.id, applicant.id);
                                    if (!result.ok) alert(result.message);
                                  }}
                                  className="btn btn-ghost text-xs"
                                >
                                  Unassign
                                </button>
                                <button
                                  onClick={() => updateApplicantStatus(selectedConference.id, applicant.id, "Rejected")}
                                  className="btn btn-ghost text-xs"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => toggleApplicantPayment(selectedConference.id, applicant.id)}
                                  className="btn btn-outline-blue text-xs"
                                >
                                  {applicant.paid ? "Set Unpaid" : "Mark Paid"}
                                </button>
                                <button
                                  onClick={() => void syncAndIssuePass(selectedConference, applicant.id)}
                                  className="btn btn-outline-blue text-xs"
                                >
                                  Issue Pass
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {selectedApplicant && (
                      <div className="mt-5 p-4 rounded-xl" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-sm" style={{ color: "var(--fg)" }}>
                            Applicant Profile · {selectedApplicant.name}
                          </h4>
                          <button className="btn btn-ghost text-xs" onClick={() => setSelectedApplicantId("")}>Close</button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3 text-xs" style={{ color: "var(--fg-muted)" }}>
                          <p><strong style={{ color: "var(--fg)" }}>School:</strong> {selectedApplicant.school || "N/A"}</p>
                          <p><strong style={{ color: "var(--fg)" }}>Country:</strong> {selectedApplicant.countryPreference || "N/A"}</p>
                          <p><strong style={{ color: "var(--fg)" }}>Category:</strong> {selectedApplicant.categoryName || "N/A"}</p>
                          <p><strong style={{ color: "var(--fg)" }}>Current Status:</strong> {selectedApplicant.status}</p>
                        </div>
                        <div className="mt-3">
                          <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>Submitted responses</p>
                          {Object.entries(selectedApplicant.responses || {}).length === 0 ? (
                            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No responses stored.</p>
                          ) : (
                            <div className="grid md:grid-cols-2 gap-2">
                              {Object.entries(selectedApplicant.responses || {}).map(([key, value]) => (
                                <p key={key} className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                  <strong style={{ color: "var(--fg)" }}>{key}:</strong> {String(value)}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Committees</h3>
                      <div className="flex items-center gap-2 mb-3">
                        <select
                          className="input-base text-xs"
                          value={matrixCommitteeType}
                          onChange={(event) => setMatrixCommitteeType(event.target.value)}
                        >
                          <option value="all">All committee types</option>
                          {Array.from(new Set(selectedConference.committees.map((entry) => entry.type || "General"))).map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                          <input
                            type="checkbox"
                            checked={matrixOnlyAvailable}
                            onChange={(event) => setMatrixOnlyAvailable(event.target.checked)}
                          />
                          Only available seats
                        </label>
                      </div>
                      <div className="space-y-3">
                        {selectedConference.committees
                          .filter((committee) => matrixCommitteeType === "all" || (committee.type || "General") === matrixCommitteeType)
                          .map((committee) => (
                          <div key={committee.id} className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                            <p className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{committee.name}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{committee.agenda}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              Seats: {committee.seatCount} · Allotted: {committee.allottedCount ?? 0} · Available: {committee.seatCount - (committee.allottedCount ?? 0)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              Type: {committee.type || "General"} · Chair: {committee.chairName || "TBA"} · Visibility: {committee.isPublic === false ? "Private" : "Public"}
                            </p>
                            {committee.basePrice !== undefined && (
                              <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>Base Price: ${committee.basePrice}</p>
                            )}
                            {(committee.customQuestions ?? []).length > 0 && (
                              <div className="mt-1">
                                {(committee.customQuestions ?? []).map((question) => (
                                  <p key={question.id} className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                    ? {question.question}
                                  </p>
                                ))}
                              </div>
                            )}
                            {(committee.portfolios ?? []).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {(committee.portfolios ?? [])
                                  .filter((portfolio) => {
                                    if (!matrixOnlyAvailable) return true;
                                    const remaining = portfolio.seatCount - portfolio.assignedApplicantIds.length;
                                    return remaining > 0;
                                  })
                                  .map((portfolio) => (
                                  <p key={portfolio.id} className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                    • {portfolio.name}: {portfolio.assignedApplicantIds.length}/{portfolio.seatCount}
                                  </p>
                                ))}
                              </div>
                            )}
                            <button
                              className="btn btn-ghost text-xs mt-2"
                              onClick={() => {
                                const nextSeat = prompt(`Override seat limit for ${committee.name}`, String(committee.seatCount));
                                if (!nextSeat) return;
                                const parsed = Number(nextSeat);
                                if (Number.isNaN(parsed) || parsed <= 0) return;
                                overrideSeatLimit(selectedConference.id, committee.id, parsed);
                              }}
                            >
                              Override Seat Limit
                            </button>
                            <button
                              className="btn btn-ghost text-xs mt-2"
                              onClick={() => {
                                const type = prompt(`Committee type for ${committee.name}`, committee.type || "General");
                                const chairName = prompt(`Chair name for ${committee.name}`, committee.chairName || "");
                                const chairEmail = prompt(`Chair email for ${committee.name}`, committee.chairEmail || "");
                                const questions = prompt(
                                  `Custom questions for ${committee.name} (comma separated)`,
                                  (committee.customQuestions ?? []).map((entry) => entry.question).join(", ")
                                );
                                updateOrganizerCommitteeConfig(selectedConference.id, committee.id, {
                                  type: type || undefined,
                                  chairName: chairName || undefined,
                                  chairEmail: chairEmail || undefined,
                                  customQuestions: (questions || "")
                                    .split(",")
                                    .map((entry, index) => ({
                                      id: `${committee.id}-q-${index}`,
                                      question: entry.trim(),
                                      required: true,
                                    }))
                                    .filter((entry) => entry.question),
                                });
                              }}
                            >
                              Edit Metadata
                            </button>
                            <button
                              className="btn btn-ghost text-xs mt-2"
                              onClick={() =>
                                updateOrganizerCommitteeConfig(selectedConference.id, committee.id, {
                                  isPublic: !(committee.isPublic !== false),
                                })
                              }
                            >
                              {committee.isPublic === false ? "Set Public" : "Set Private"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Broadcast Announcement</h3>
                      <div className="space-y-3">
                        <input
                          value={announcementTitle}
                          onChange={(event) => setAnnouncementTitle(event.target.value)}
                          className="input-base"
                          placeholder="Title"
                        />
                        <textarea
                          value={announcementMessage}
                          onChange={(event) => setAnnouncementMessage(event.target.value)}
                          className="input-base"
                          rows={4}
                          placeholder="Share an update with delegates..."
                          style={{ resize: "none" }}
                        />
                        <button
                          className="btn btn-primary w-full text-sm"
                          disabled={!announcementTitle.trim() || !announcementMessage.trim()}
                          style={{ opacity: announcementTitle.trim() && announcementMessage.trim() ? 1 : 0.6 }}
                          onClick={() => {
                            addAnnouncement(selectedConference.id, announcementTitle.trim(), announcementMessage.trim());
                            setAnnouncementTitle("");
                            setAnnouncementMessage("");
                          }}
                        >
                          Send Announcement
                        </button>
                      </div>
                      <div className="space-y-2 mt-4">
                        {selectedConference.announcements.slice(0, 3).map((announcement) => (
                          <div key={announcement.id} className="p-3 rounded-xl text-xs" style={{ background: "var(--bg-subtle)" }}>
                            <p className="font-semibold" style={{ color: "var(--fg)" }}>{announcement.title}</p>
                            <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{announcement.message}</p>
                            <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{announcement.createdAt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="card p-6 rounded-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Delegation Groups</h3>
                        <button
                          className="btn btn-ghost text-xs"
                          onClick={() => {
                            const code = Math.random().toString(36).slice(2, 9).toUpperCase();
                            updateOrganizerConferenceConfig(selectedConference.id, { delegationInviteCode: code });
                          }}
                        >
                          Generate Invite Link
                        </button>
                      </div>
                      <p className="text-xs mb-3" style={{ color: "var(--fg-muted)" }}>
                        Invite code: {selectedConference.delegationInviteCode || "Not generated"}
                      </p>
                      <div className="space-y-2">
                        {delegationGroups.map((group) => (
                          <div key={group.school} className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                            <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{group.school}</p>
                            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                              Members: {group.members.length} · Paid: {group.paidMembers} · Assigned: {group.assignedMembers}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Transactions</h3>
                      {!financeSummary ? (
                        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No finance data.</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {[
                              { label: "Gross", value: `$${financeSummary.gross}` },
                              { label: "Successful", value: `${financeSummary.successfulCount} ($${financeSummary.successfulAmount})` },
                              { label: "Pending", value: financeSummary.pending },
                              { label: "Refunds", value: `${financeSummary.refundCount} ($${financeSummary.refundAmount})` },
                            ].map((item) => (
                              <div key={item.label} className="rounded-xl p-2" style={{ background: "var(--bg-subtle)" }}>
                                <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{item.label}</p>
                                <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{item.value}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs mb-2" style={{ color: "var(--fg-muted)" }}>
                            Net after fees (6%): <strong style={{ color: "var(--fg)" }}>${financeSummary.netAfterFees}</strong>
                          </p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {selectedConference.applicants.map((applicant) => (
                              <div key={applicant.id} className="p-2 rounded-lg flex items-center justify-between" style={{ background: "var(--bg-subtle)" }}>
                                <div>
                                  <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{applicant.name}</p>
                                  <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                                    ${applicant.amount || 0} · {applicant.paid ? "Paid" : "Pending"} · {refundedApplicantIds[applicant.id] ? "Refunded" : "Active"}
                                  </p>
                                </div>
                                <button
                                  className="btn btn-ghost text-xs"
                                  disabled={!applicant.paid}
                                  onClick={() =>
                                    setRefundedApplicantIds((prev) => ({
                                      ...prev,
                                      [applicant.id]: !prev[applicant.id],
                                    }))
                                  }
                                >
                                  {refundedApplicantIds[applicant.id] ? "Undo Refund" : "Refund"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Conference Settings</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Partner conferences</label>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {organizerConferences
                              .filter((entry) => entry.id !== selectedConference.id)
                              .map((entry) => {
                                const selected = (selectedConference.partnerConferenceIds || []).includes(entry.id);
                                return (
                                  <button
                                    key={entry.id}
                                    className="btn btn-ghost text-xs"
                                    style={{
                                      borderColor: selected ? "var(--blue)" : "var(--border)",
                                      color: selected ? "var(--blue)" : "var(--fg-muted)",
                                    }}
                                    onClick={() => {
                                      const current = selectedConference.partnerConferenceIds || [];
                                      const next = selected
                                        ? current.filter((id) => id !== entry.id)
                                        : [...current, entry.id];
                                      updateOrganizerConferenceConfig(selectedConference.id, {
                                        partnerConferenceIds: next,
                                      });
                                    }}
                                  >
                                    {entry.title}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                          <p className="text-xs font-semibold mb-2" style={{ color: "var(--fg)" }}>Previous editions</p>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <input className="input-base text-xs" placeholder="Year" value={editionDraft.year} onChange={(event) => setEditionDraft((prev) => ({ ...prev, year: event.target.value }))} />
                            <input className="input-base text-xs" placeholder="Edition title" value={editionDraft.title} onChange={(event) => setEditionDraft((prev) => ({ ...prev, title: event.target.value }))} />
                            <input className="input-base text-xs" placeholder="Delegates" value={editionDraft.delegates} onChange={(event) => setEditionDraft((prev) => ({ ...prev, delegates: event.target.value }))} />
                            <input className="input-base text-xs" placeholder="Highlights" value={editionDraft.highlights} onChange={(event) => setEditionDraft((prev) => ({ ...prev, highlights: event.target.value }))} />
                          </div>
                          <button
                            className="btn btn-primary text-xs"
                            onClick={() => {
                              if (!editionDraft.year.trim() || !editionDraft.title.trim()) return;
                              updateOrganizerConferenceConfig(selectedConference.id, {
                                previousEditions: [
                                  ...(selectedConference.previousEditions || []),
                                  {
                                    id: `ed-${Date.now()}`,
                                    year: editionDraft.year.trim(),
                                    title: editionDraft.title.trim(),
                                    delegates: Number(editionDraft.delegates) || 0,
                                    highlights: editionDraft.highlights.trim() || undefined,
                                  },
                                ],
                              });
                              setEditionDraft({ year: "", title: "", delegates: "", highlights: "" });
                            }}
                          >
                            Add Edition
                          </button>
                          <div className="mt-2 space-y-1">
                            {(selectedConference.previousEditions || []).map((edition) => (
                              <p key={edition.id} className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                {edition.year} · {edition.title} · {edition.delegates} delegates
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Organizer Team</h3>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input className="input-base text-xs" placeholder="Name" value={teamDraft.name} onChange={(event) => setTeamDraft((prev) => ({ ...prev, name: event.target.value }))} />
                        <input className="input-base text-xs" placeholder="Email" value={teamDraft.email} onChange={(event) => setTeamDraft((prev) => ({ ...prev, email: event.target.value }))} />
                        <select className="input-base text-xs col-span-2" value={teamDraft.role} onChange={(event) => setTeamDraft((prev) => ({ ...prev, role: event.target.value as "Lead Organizer" | "USG" | "Logistics Head" | "Committee Head" }))}>
                          <option value="Lead Organizer">Lead Organizer</option>
                          <option value="USG">USG</option>
                          <option value="Logistics Head">Logistics Head</option>
                          <option value="Committee Head">Committee Head</option>
                        </select>
                      </div>
                      <button
                        className="btn btn-primary text-xs mb-3"
                        onClick={() => {
                          if (!teamDraft.name.trim() || !teamDraft.email.trim()) return;
                          updateOrganizerConferenceConfig(selectedConference.id, {
                            organizerTeam: [
                              ...(selectedConference.organizerTeam || []),
                              {
                                id: `team-${Date.now()}`,
                                name: teamDraft.name.trim(),
                                email: teamDraft.email.trim(),
                                role: teamDraft.role,
                                permissions:
                                  teamDraft.role === "Lead Organizer"
                                    ? ["view", "applications", "finance", "settings", "publishing"]
                                    : teamDraft.role === "USG"
                                      ? ["view", "applications", "publishing"]
                                      : teamDraft.role === "Logistics Head"
                                        ? ["view", "settings"]
                                        : ["view", "applications"],
                              },
                            ],
                          });
                          setTeamDraft({ name: "", email: "", role: "USG" });
                        }}
                      >
                        Add Team Member
                      </button>
                      <div className="space-y-2">
                        {(selectedConference.organizerTeam || []).map((member) => (
                          <div key={member.id} className="p-2 rounded-xl flex items-center justify-between" style={{ background: "var(--bg-subtle)" }}>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{member.name} · {member.role}</p>
                              <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{member.email}</p>
                              <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{member.permissions.join(", ")}</p>
                            </div>
                            <button
                              className="btn btn-ghost text-xs"
                              onClick={() =>
                                updateOrganizerConferenceConfig(selectedConference.id, {
                                  organizerTeam: (selectedConference.organizerTeam || []).filter((entry) => entry.id !== member.id),
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Awards Module</h3>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input className="input-base text-xs" placeholder="Award category" value={awardDraft.category} onChange={(event) => setAwardDraft((prev) => ({ ...prev, category: event.target.value }))} />
                        <input className="input-base text-xs" placeholder="Prize title" value={awardDraft.prizeTitle} onChange={(event) => setAwardDraft((prev) => ({ ...prev, prizeTitle: event.target.value }))} />
                        <input className="input-base text-xs" placeholder="Sponsor name" value={awardDraft.sponsorName} onChange={(event) => setAwardDraft((prev) => ({ ...prev, sponsorName: event.target.value }))} />
                        <input className="input-base text-xs" placeholder="Sponsor logo URL" value={awardDraft.sponsorLogoUrl} onChange={(event) => setAwardDraft((prev) => ({ ...prev, sponsorLogoUrl: event.target.value }))} />
                        <input className="input-base text-xs col-span-2" placeholder="Description" value={awardDraft.description} onChange={(event) => setAwardDraft((prev) => ({ ...prev, description: event.target.value }))} />
                      </div>
                      <button
                        className="btn btn-primary text-xs mb-3"
                        onClick={() => {
                          if (!awardDraft.category.trim()) return;
                          addConferenceAward(selectedConference.id, {
                            category: awardDraft.category.trim(),
                            prizeTitle: awardDraft.prizeTitle.trim() || undefined,
                            sponsorName: awardDraft.sponsorName.trim() || undefined,
                            sponsorLogoUrl: awardDraft.sponsorLogoUrl.trim() || undefined,
                            description: awardDraft.description.trim() || undefined,
                          });
                          setAwardDraft({
                            category: "",
                            prizeTitle: "",
                            sponsorName: "",
                            sponsorLogoUrl: "",
                            description: "",
                          });
                        }}
                      >
                        Add Award
                      </button>
                      <div className="space-y-2">
                        {(selectedConference.awards || []).map((award) => (
                          <div key={award.id} className="p-2 rounded-xl flex items-center justify-between" style={{ background: "var(--bg-subtle)" }}>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{award.category}</p>
                              <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                                {award.prizeTitle || "No prize"} · {award.sponsorName || "No sponsor"}
                              </p>
                            </div>
                            <button className="btn btn-ghost text-xs" onClick={() => removeConferenceAward(selectedConference.id, award.id)}>Remove</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Reviews Moderation</h3>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {(selectedConference.reviews || []).map((review) => (
                          <div key={review.id} className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                            <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>
                              {review.userName} · {review.rating}/5
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{review.comment}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <button className="btn btn-ghost text-xs" onClick={() => moderateConferenceReview(selectedConference.id, review.id, { status: "approved" })}>Approve</button>
                              <button className="btn btn-ghost text-xs" onClick={() => moderateConferenceReview(selectedConference.id, review.id, { status: "hidden" })}>Hide</button>
                              <button className="btn btn-ghost text-xs" onClick={() => moderateConferenceReview(selectedConference.id, review.id, { featured: !review.featured })}>
                                {review.featured ? "Unfeature" : "Feature"}
                              </button>
                              <span className="badge badge-gray">{review.status}</span>
                            </div>
                          </div>
                        ))}
                        {(selectedConference.reviews || []).length === 0 && (
                          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No reviews yet.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="card p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Registration Categories</h3>
                    <div className="space-y-4">
                      {selectedConference.registrationCategories.map((category) => {
                        const activePhase = getActivePhase(category.pricingPhases);
                        return (
                          <div key={category.id} className="p-4 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{category.name}</p>
                                <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{category.description || "No description yet."}</p>
                              </div>
                              <span className="badge badge-blue">
                                {activePhase ? `${activePhase.name} Active` : "Base Price"}
                              </span>
                            </div>
                            <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
                              Default ${category.basePrice} · {category.requiresCommitteeSelection ? "Committee required" : "No committee selection"}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              {category.formFields.length} custom form fields · {category.pricingPhases.length} pricing phases
                            </p>
                            <div className="grid md:grid-cols-3 gap-2 mt-3">
                              <select
                                className="input-base text-xs"
                                value={category.applicationType || "delegate"}
                                onChange={(event) =>
                                  updateRegistrationCategoryConfig(selectedConference.id, category.id, {
                                    applicationType: event.target.value as "delegate" | "chair" | "delegation" | "organizer",
                                  })
                                }
                              >
                                <option value="delegate">Delegate</option>
                                <option value="chair">Chair</option>
                                <option value="delegation">Delegation</option>
                                <option value="organizer">Organizer Team</option>
                              </select>
                              <input
                                className="input-base text-xs"
                                type="date"
                                value={category.deadlineOverride || selectedConference.registrationDeadline || ""}
                                onChange={(event) =>
                                  updateRegistrationCategoryConfig(selectedConference.id, category.id, {
                                    deadlineOverride: event.target.value,
                                  })
                                }
                              />
                              <label className="flex items-center gap-2 text-xs px-2" style={{ color: "var(--fg-muted)" }}>
                                <input
                                  type="checkbox"
                                  checked={category.isOpen !== false}
                                  onChange={(event) =>
                                    updateRegistrationCategoryConfig(selectedConference.id, category.id, {
                                      isOpen: event.target.checked,
                                    })
                                  }
                                />
                                Application Open
                              </label>
                            </div>
                            {category.pricingPhases.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {category.pricingPhases.map((phase) => (
                                  <div key={phase.id} className="flex items-center justify-between text-xs" style={{ color: "var(--fg-muted)" }}>
                                    <span>{phase.name}</span>
                                    <span>${phase.basePrice} · {phase.startDate} to {phase.endDate}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <QrScannerPanel />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
