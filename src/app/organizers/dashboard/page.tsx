"use client";

import { ChangeEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import QrScannerPanel from "@/components/QrScannerPanel";
import { ensureServerSession } from "@/lib/client/session";
import { useAuth } from "@/lib/auth-context";
import { OrganizerBankingDetails, OrganizerConference, OrganizerStatusEmailTemplateKey } from "@/lib/types";
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

const getCommitteeTypeLabel = (committee: OrganizerConference["committees"][number]) => {
  if (committee.committeeType === "UN") return "UN";
  if (committee.committeeType === "NON_UN") return "Non-UN";
  if (committee.committeeType === "CUSTOM") {
    return committee.customTypeLabel?.trim() || committee.type?.trim() || "Custom";
  }
  return committee.type?.trim() || "UN";
};

const UN_COUNTRY_NAMES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia",
  "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad",
  "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus",
  "Czech Republic", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji",
  "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala",
  "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
  "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
  "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
  "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia",
  "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain",
  "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand",
  "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda",
  "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
] as const;

const UN_TEMPLATE_COUNTRIES = {
  UNSC: [
    "Algeria", "China", "Denmark", "France", "Greece", "Guyana", "Pakistan", "Panama",
    "Republic of Korea", "Russian Federation", "Sierra Leone", "Slovenia", "Somalia", "United Kingdom", "United States",
  ],
  UNGA: [...UN_COUNTRY_NAMES],
  ECOSOC: [
    "Algeria", "Antigua and Barbuda", "Armenia", "Bangladesh", "Belgium", "Belize", "Bolivia", "Botswana", "Brazil",
    "Bulgaria", "Burundi", "Cameroon", "Canada", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo",
    "Costa Rica", "Croatia", "Czech Republic", "Democratic Republic of the Congo", "Dominican Republic", "Egypt",
    "El Salvador", "Equatorial Guinea", "France", "Germany", "Ghana", "Guinea-Bissau", "India", "Indonesia", "Iraq",
    "Ireland", "Italy", "Japan", "Liberia", "Libya", "Mauritius", "Mexico", "Morocco", "Nepal", "Nigeria", "Peru",
    "Republic of Korea", "Romania", "Russian Federation", "Sierra Leone", "Slovenia", "Somalia", "Spain", "Tanzania", "Turkey",
  ],
  UNHRC: [
    "Albania", "Algeria", "Bangladesh", "Belgium", "Benin", "Bolivia", "Brazil", "Bulgaria", "Burundi", "Cameroon",
    "Chile", "China", "Costa Rica", "Cote d'Ivoire", "Cuba", "Cyprus", "Czech Republic", "Dominican Republic",
    "Ethiopia", "France", "Gambia", "Georgia", "Germany", "Ghana", "Honduras", "India", "Indonesia", "Japan",
    "Kuwait", "Kyrgyzstan", "Malawi", "Maldives", "Marshall Islands", "Mexico", "Montenegro", "Morocco", "Netherlands",
    "Paraguay", "Qatar", "Romania", "South Africa", "Sudan", "Switzerland", "Thailand", "United Arab Emirates",
    "United Kingdom", "Vietnam",
  ],
} as const;

type UnTemplateKey = keyof typeof UN_TEMPLATE_COUNTRIES;

const buildDefaultStatusEmailTemplates = (conferenceTitle: string) => ({
  allotted: {
    subject: `Application accepted - ${conferenceTitle}`,
    body: `Hi {{applicantName}},\n\nYour application for {{conferenceTitle}} has been accepted.\nStatus: {{status}}\nCommittee: {{assignedCommittee}}\nCountry/Portfolio: {{assignedPortfolio}}\n\nRegards,\n{{conferenceTitle}} Organizing Team`,
  },
  rejected: {
    subject: `Application update - ${conferenceTitle}`,
    body: `Hi {{applicantName}},\n\nThank you for applying to {{conferenceTitle}}.\nWe regret to inform you that your application is currently {{status}}.\n\nRegards,\n{{conferenceTitle}} Organizing Team`,
  },
  waitlisted: {
    subject: `Application waitlisted - ${conferenceTitle}`,
    body: `Hi {{applicantName}},\n\nYour application for {{conferenceTitle}} has been moved to {{status}}.\nWe will contact you if a seat opens up.\n\nRegards,\n{{conferenceTitle}} Organizing Team`,
  },
  invited: {
    subject: `Invitation update - ${conferenceTitle}`,
    body: `Hi {{applicantName}},\n\nYou are {{status}} for {{conferenceTitle}}.\nPlease complete the required next steps to confirm your participation.\n\nRegards,\n{{conferenceTitle}} Organizing Team`,
  },
});


export default function OrganizerDashboardPage() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
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
    addOrganizerCommittee,
    removeOrganizerCommittee,
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
  const [applicantProfileDrawerOpen, setApplicantProfileDrawerOpen] = useState(false);
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [participantStatusFilter, setParticipantStatusFilter] = useState<
    "all" | "Pending" | "Invited" | "Allotted" | "Waitlisted" | "Rejected"
  >("all");
  const [participantSortKey, setParticipantSortKey] = useState<"name" | "status" | "committee">("name");
  const [selectedStatusEmailTemplate, setSelectedStatusEmailTemplate] =
    useState<OrganizerStatusEmailTemplateKey>("allotted");
  const [countryMatrixCommitteeFilter, setCountryMatrixCommitteeFilter] = useState("all");
  const [countryMatrixSeatFilter, setCountryMatrixSeatFilter] = useState<"all" | "available" | "allotted">("all");
  const [countryMatrixSearch, setCountryMatrixSearch] = useState("");
  const [matrixOnlyAvailable, setMatrixOnlyAvailable] = useState(false);
  const [matrixCommitteeType, setMatrixCommitteeType] = useState("all");
  const [refundedApplicantIds, setRefundedApplicantIds] = useState<Record<string, boolean>>({});
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [transactionPaymentFilter, setTransactionPaymentFilter] = useState<"all" | "paid" | "pending">("all");
  const [transactionRefundFilter, setTransactionRefundFilter] = useState<"all" | "active" | "refunded">("all");
  const [transactionApplicantStatusFilter, setTransactionApplicantStatusFilter] = useState<
    "all" | "Pending" | "Invited" | "Allotted" | "Waitlisted" | "Rejected"
  >("all");
  const [bankingSaveStatus, setBankingSaveStatus] = useState("");
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
  const [committeeDraft, setCommitteeDraft] = useState({
    name: "",
    agenda: "",
    seatCount: "",
    committeeType: "UN" as "UN" | "NON_UN" | "CUSTOM",
    customTypeLabel: "",
    members: [] as Array<{ id: string; name: string; seatCount: string }>,
    memberInput: "",
  });
  const [createTemplateSelection, setCreateTemplateSelection] = useState<UnTemplateKey>("UNSC");
  const [countryEditorOpen, setCountryEditorOpen] = useState(false);
  const [countryEditorCommitteeId, setCountryEditorCommitteeId] = useState("");
  const [countryEditorDraftCountries, setCountryEditorDraftCountries] = useState<
    Array<{ id: string; name: string; seatCount: number; assignedApplicantIds: string[] }>
  >([]);
  const [countryEditorManualInput, setCountryEditorManualInput] = useState("");
  const [countryEditorSearch, setCountryEditorSearch] = useState("");
  const [editorTemplateSelection, setEditorTemplateSelection] = useState<UnTemplateKey>("UNSC");
  const [detailsEditorOpen, setDetailsEditorOpen] = useState(false);
  const [detailsEditorCommitteeId, setDetailsEditorCommitteeId] = useState("");
  const [detailsEditorDraft, setDetailsEditorDraft] = useState({
    name: "",
    description: "",
    agenda: "",
    logoImageUrl: "",
    chairs: [] as Array<{ id: string; name: string; email: string }>,
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

  const memberModeForType = (committeeType: "UN" | "NON_UN" | "CUSTOM") =>
    committeeType === "UN" ? "UN_COUNTRY" : "CUSTOM_MEMBER";

  const memberLabelForType = (committeeType: "UN" | "NON_UN" | "CUSTOM") =>
    committeeType === "UN" ? "Country" : "Member";

  const addDraftMember = () => {
    setCommitteeDraft((prev) => {
      const label = prev.memberInput.trim();
      if (!label) return prev;
      return {
        ...prev,
        memberInput: "",
        members: [
          ...prev.members,
          { id: `member-${Date.now()}`, name: label, seatCount: "1" },
        ],
      };
    });
  };

  const updateDraftMember = (memberId: string, patch: Partial<{ name: string; seatCount: string }>) => {
    setCommitteeDraft((prev) => ({
      ...prev,
      members: prev.members.map((member) => (member.id === memberId ? { ...member, ...patch } : member)),
    }));
  };

  const removeDraftMember = (memberId: string) => {
    setCommitteeDraft((prev) => ({
      ...prev,
      members: prev.members.filter((member) => member.id !== memberId),
    }));
  };

  const addUnCountryFromList = (countryName: string) => {
    setCommitteeDraft((prev) => {
      const exists = prev.members.some(
        (member) => member.name.trim().toLowerCase() === countryName.trim().toLowerCase()
      );
      if (exists) return prev;
      return {
        ...prev,
        members: [...prev.members, { id: `un-${Date.now()}`, name: countryName, seatCount: "1" }],
      };
    });
  };

  const importTemplateIntoCreateDraft = (templateKey: UnTemplateKey) => {
    const templateCountries = UN_TEMPLATE_COUNTRIES[templateKey];
    setCommitteeDraft((prev) => {
      const existing = new Set(prev.members.map((entry) => entry.name.trim().toLowerCase()));
      const additions = templateCountries
        .filter((country) => !existing.has(country.toLowerCase()))
        .map((country, index) => ({
          id: `template-${templateKey.toLowerCase()}-${Date.now()}-${index}`,
          name: country,
          seatCount: "1",
        }));
      if (additions.length === 0) return prev;
      return { ...prev, members: [...prev.members, ...additions] };
    });
  };

  const openCountryEditor = (committee: OrganizerConference["committees"][number]) => {
    setCountryEditorCommitteeId(committee.id);
    setCountryEditorDraftCountries(
      (committee.portfolios ?? []).map((entry, index) => ({
        id: entry.id || `${committee.id}-country-${index}`,
        name: entry.name,
        seatCount: entry.seatCount || 1,
        assignedApplicantIds: entry.assignedApplicantIds ?? [],
      }))
    );
    setCountryEditorManualInput("");
    setCountryEditorSearch("");
    setEditorTemplateSelection("UNSC");
    setCountryEditorOpen(true);
  };

  const addCountryToEditor = (countryName: string) => {
    const normalizedName = countryName.trim();
    if (!normalizedName) return;
    setCountryEditorDraftCountries((prev) => {
      const exists = prev.some((entry) => entry.name.trim().toLowerCase() === normalizedName.toLowerCase());
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `country-${Date.now()}-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name: normalizedName,
          seatCount: 1,
          assignedApplicantIds: [],
        },
      ];
    });
    setCountryEditorManualInput("");
  };

  const importTemplateIntoEditor = (templateKey: UnTemplateKey) => {
    const templateCountries = UN_TEMPLATE_COUNTRIES[templateKey];
    setCountryEditorDraftCountries((prev) => {
      const existing = new Set(prev.map((entry) => entry.name.trim().toLowerCase()));
      const additions = templateCountries
        .filter((country) => !existing.has(country.toLowerCase()))
        .map((country, index) => ({
          id: `editor-template-${templateKey.toLowerCase()}-${Date.now()}-${index}`,
          name: country,
          seatCount: 1,
          assignedApplicantIds: [] as string[],
        }));
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
  };

  const removeCountryFromEditor = (countryId: string) => {
    setCountryEditorDraftCountries((prev) => prev.filter((entry) => entry.id !== countryId));
  };

  const saveCountryEditor = (conferenceId: string) => {
    if (!countryEditorCommitteeId) return;
    updateOrganizerCommitteeConfig(conferenceId, countryEditorCommitteeId, {
      portfolios: countryEditorDraftCountries,
    });
    setCountryEditorOpen(false);
    setCountryEditorCommitteeId("");
    setCountryEditorDraftCountries([]);
    setCountryEditorManualInput("");
    setCountryEditorSearch("");
  };

  const openDetailsEditor = (committee: OrganizerConference["committees"][number]) => {
    setDetailsEditorCommitteeId(committee.id);
    setDetailsEditorDraft({
      name: committee.name || "",
      description: committee.description || "",
      agenda: committee.agenda || "",
      logoImageUrl: committee.logoImageUrl || "",
      chairs:
        (committee.chairs ?? []).length > 0
          ? (committee.chairs ?? []).map((chair, index) => ({
              id: chair.id || `${committee.id}-chair-${index}`,
              name: chair.name || "",
              email: chair.email || "",
            }))
          : committee.chairName
            ? [{ id: `${committee.id}-chair-legacy`, name: committee.chairName, email: committee.chairEmail || "" }]
            : [],
    });
    setDetailsEditorOpen(true);
  };

  const addChairDraftRow = () => {
    setDetailsEditorDraft((prev) => ({
      ...prev,
      chairs: [...prev.chairs, { id: `chair-${Date.now()}`, name: "", email: "" }],
    }));
  };

  const updateChairDraftRow = (chairId: string, patch: Partial<{ name: string; email: string }>) => {
    setDetailsEditorDraft((prev) => ({
      ...prev,
      chairs: prev.chairs.map((chair) => (chair.id === chairId ? { ...chair, ...patch } : chair)),
    }));
  };

  const removeChairDraftRow = (chairId: string) => {
    setDetailsEditorDraft((prev) => ({
      ...prev,
      chairs: prev.chairs.filter((chair) => chair.id !== chairId),
    }));
  };

  const onCommitteeLogoFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      alert("Please choose an image file.");
      event.target.value = "";
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      alert("Committee logo must be under 2MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDetailsEditorDraft((prev) => ({ ...prev, logoImageUrl: reader.result }));
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const saveCommitteeDetails = (conferenceId: string) => {
    if (!detailsEditorCommitteeId) return;
    const normalizedChairs = detailsEditorDraft.chairs
      .map((chair, index) => ({
        id: chair.id || `${detailsEditorCommitteeId}-chair-${index}`,
        name: chair.name.trim(),
        email: chair.email.trim() || undefined,
      }))
      .filter((chair) => chair.name);
    updateOrganizerCommitteeConfig(conferenceId, detailsEditorCommitteeId, {
      name: detailsEditorDraft.name.trim() || "Committee",
      description: detailsEditorDraft.description.trim() || undefined,
      agenda: detailsEditorDraft.agenda.trim() || "Agenda will be announced",
      logoImageUrl: detailsEditorDraft.logoImageUrl.trim() || undefined,
      chairs: normalizedChairs,
      chairName: normalizedChairs[0]?.name,
      chairEmail: normalizedChairs[0]?.email,
    });
    setDetailsEditorOpen(false);
    setDetailsEditorCommitteeId("");
  };

  const tryDeleteCommittee = (conference: OrganizerConference, committee: OrganizerConference["committees"][number]) => {
    const allottedCount = conference.applicants.filter(
      (applicant) => applicant.status === "Allotted" && applicant.assignedCommitteeId === committee.id
    ).length;
    if (allottedCount > 0) {
      alert("Cannot delete this committee while applicants are allotted to it. Unassign them first.");
      return;
    }
    const confirmed = confirm(`Delete committee "${committee.name}"?`);
    if (!confirmed) return;
    removeOrganizerCommittee(conference.id, committee.id);
  };

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
  const selectedApplicantUserProfile = useMemo(() => {
    if (!selectedApplicant || !user) return null;
    if (selectedApplicant.userId && selectedApplicant.userId === user.id) return user;
    if (selectedApplicant.userEmail && selectedApplicant.userEmail === user.email) return user;
    return null;
  }, [selectedApplicant, user]);
  const selectedApplicantResponses = useMemo(
    () => Object.entries(selectedApplicant?.responses || {}),
    [selectedApplicant]
  );
  const selectedApplicantParticipationList = selectedApplicantUserProfile?.munParticipations || [];
  const selectedApplicantAwardsList = selectedApplicantUserProfile?.munAwards || [];
  const participantAllocationRows = useMemo(() => {
    if (!selectedConference) return [];
    const searchValue = participantSearchQuery.trim().toLowerCase();

    return [...selectedConference.applicants]
      .filter((applicant) => {
        if (participantStatusFilter !== "all" && applicant.status !== participantStatusFilter) return false;
        if (!searchValue) return true;
        const haystack = [
          applicant.name,
          applicant.school,
          applicant.categoryName,
          applicant.status,
          applicant.assignedCommitteeName,
          applicant.assignedPortfolioName,
          applicant.countryPreference,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchValue);
      })
      .sort((a, b) => {
        if (participantSortKey === "status") return a.status.localeCompare(b.status);
        if (participantSortKey === "committee") {
          return (a.assignedCommitteeName || "Not allotted").localeCompare(b.assignedCommitteeName || "Not allotted");
        }
        return a.name.localeCompare(b.name);
      });
  }, [selectedConference, participantSearchQuery, participantStatusFilter, participantSortKey]);
  const countryMatrixGroups = useMemo(() => {
    if (!selectedConference) return [];
    const searchValue = countryMatrixSearch.trim().toLowerCase();

    return selectedConference.committees
      .filter((committee) => countryMatrixCommitteeFilter === "all" || committee.id === countryMatrixCommitteeFilter)
      .map((committee) => {
        const entries = (committee.portfolios ?? [])
          .map((portfolio) => {
            const allottedCount = portfolio.assignedApplicantIds.length;
            const availableCount = Math.max(portfolio.seatCount - allottedCount, 0);
            const seatState = availableCount > 0 ? "available" : "allotted";
            return {
              ...portfolio,
              allottedCount,
              availableCount,
              seatState,
            };
          })
          .filter((entry) => {
            if (countryMatrixSeatFilter !== "all" && entry.seatState !== countryMatrixSeatFilter) return false;
            if (!searchValue) return true;
            return entry.name.toLowerCase().includes(searchValue);
          })
          .sort((a, b) => {
            if (a.seatState === b.seatState) return a.name.localeCompare(b.name);
            return a.seatState === "available" ? -1 : 1;
          });

        return {
          committeeId: committee.id,
          committeeName: committee.name,
          committeeType: getCommitteeTypeLabel(committee),
          entries,
        };
      })
      .filter((committee) => committee.entries.length > 0);
  }, [selectedConference, countryMatrixCommitteeFilter, countryMatrixSearch, countryMatrixSeatFilter]);
  const countryMatrixTotals = useMemo(() => {
    const total = countryMatrixGroups.reduce((sum, committee) => sum + committee.entries.length, 0);
    const available = countryMatrixGroups.reduce(
      (sum, committee) => sum + committee.entries.filter((entry) => entry.seatState === "available").length,
      0
    );
    const allotted = total - available;
    return { total, available, allotted };
  }, [countryMatrixGroups]);

  const formatResponseLabel = (key: string) =>
    key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\w/, (match) => match.toUpperCase());
  const updateCategoryBasePrice = (conferenceId: string, categoryId: string, basePriceInput: string) => {
    const parsed = Number(basePriceInput);
    updateRegistrationCategoryConfig(conferenceId, categoryId, {
      basePrice: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    });
  };
  const addCategoryPricingPhase = (conferenceId: string, category: OrganizerConference["registrationCategories"][number]) => {
    const nextPhases = [
      ...(category.pricingPhases || []),
      {
        id: `phase-${Date.now()}`,
        name: "New Phase",
        startDate: "",
        endDate: "",
        basePrice: category.basePrice || 0,
        committeePrices: [],
      },
    ];
    updateRegistrationCategoryConfig(conferenceId, category.id, { pricingPhases: nextPhases });
  };
  const updateCategoryPricingPhase = (
    conferenceId: string,
    category: OrganizerConference["registrationCategories"][number],
    phaseId: string,
    patch: Partial<OrganizerConference["registrationCategories"][number]["pricingPhases"][number]>
  ) => {
    const nextPhases = (category.pricingPhases || []).map((phase) => {
      if (phase.id !== phaseId) return phase;
      const nextPhase = { ...phase, ...patch };
      if (typeof nextPhase.basePrice !== "number" || Number.isNaN(nextPhase.basePrice)) {
        nextPhase.basePrice = 0;
      }
      return nextPhase;
    });
    updateRegistrationCategoryConfig(conferenceId, category.id, { pricingPhases: nextPhases });
  };
  const removeCategoryPricingPhase = (conferenceId: string, category: OrganizerConference["registrationCategories"][number], phaseId: string) => {
    const nextPhases = (category.pricingPhases || []).filter((phase) => phase.id !== phaseId);
    updateRegistrationCategoryConfig(conferenceId, category.id, { pricingPhases: nextPhases });
  };
  const addCategoryQuestion = (conferenceId: string, category: OrganizerConference["registrationCategories"][number]) => {
    const nextFields = [
      ...(category.formFields || []),
      {
        id: `field-${Date.now()}`,
        label: "",
        type: "text" as const,
        required: false,
        placeholder: "",
      },
    ];
    updateRegistrationCategoryConfig(conferenceId, category.id, { formFields: nextFields });
  };
  const updateCategoryQuestion = (
    conferenceId: string,
    category: OrganizerConference["registrationCategories"][number],
    fieldId: string,
    patch: Partial<OrganizerConference["registrationCategories"][number]["formFields"][number]>
  ) => {
    const nextFields = (category.formFields || []).map((field) => {
      if (field.id !== fieldId) return field;
      const nextField = { ...field, ...patch };
      if (nextField.type !== "select") {
        delete nextField.options;
      } else if (!Array.isArray(nextField.options)) {
        nextField.options = [];
      }
      return nextField;
    });
    updateRegistrationCategoryConfig(conferenceId, category.id, { formFields: nextFields });
  };
  const removeCategoryQuestion = (conferenceId: string, category: OrganizerConference["registrationCategories"][number], fieldId: string) => {
    const nextFields = (category.formFields || []).filter((field) => field.id !== fieldId);
    updateRegistrationCategoryConfig(conferenceId, category.id, { formFields: nextFields });
  };
  const selectedCountryEditorCommittee = useMemo(() => {
    if (!selectedConference || !countryEditorCommitteeId) return null;
    return selectedConference.committees.find((entry) => entry.id === countryEditorCommitteeId) || null;
  }, [selectedConference, countryEditorCommitteeId]);
  const selectedDetailsEditorCommittee = useMemo(() => {
    if (!selectedConference || !detailsEditorCommitteeId) return null;
    return selectedConference.committees.find((entry) => entry.id === detailsEditorCommitteeId) || null;
  }, [selectedConference, detailsEditorCommitteeId]);

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
  const transactionRows = useMemo(() => {
    if (!selectedConference) return [];
    const query = transactionSearchQuery.trim().toLowerCase();
    return selectedConference.applicants
      .map((applicant) => {
        const paymentStatus = applicant.paid ? "Paid" : "Pending";
        const refundStatus = refundedApplicantIds[applicant.id] ? "Refunded" : "Active";
        return {
          id: applicant.id,
          name: applicant.name || "Unnamed Applicant",
          amount: applicant.amount || 0,
          paymentStatus,
          applicantStatus: applicant.status,
          category: applicant.categoryName || "N/A",
          committee: applicant.assignedCommitteeName || "Not allotted",
          portfolio: applicant.assignedPortfolioName || "Not allotted",
          registeredAt: applicant.registeredAt || "N/A",
          refundStatus,
          paid: applicant.paid,
        };
      })
      .filter((row) => {
        if (transactionPaymentFilter === "paid" && !row.paid) return false;
        if (transactionPaymentFilter === "pending" && row.paid) return false;
        if (transactionRefundFilter === "refunded" && row.refundStatus !== "Refunded") return false;
        if (transactionRefundFilter === "active" && row.refundStatus !== "Active") return false;
        if (transactionApplicantStatusFilter !== "all" && row.applicantStatus !== transactionApplicantStatusFilter) {
          return false;
        }
        if (!query) return true;
        const haystack = `${row.name} ${row.category} ${row.committee} ${row.portfolio} ${row.applicantStatus}`.toLowerCase();
        return haystack.includes(query);
      });
  }, [
    selectedConference,
    refundedApplicantIds,
    transactionSearchQuery,
    transactionPaymentFilter,
    transactionRefundFilter,
    transactionApplicantStatusFilter,
  ]);

  const selectedConferenceEmailTemplates = useMemo(() => {
    if (!selectedConference) return null;
    return selectedConference.statusEmailTemplates || buildDefaultStatusEmailTemplates(selectedConference.title);
  }, [selectedConference]);
  const selectedConferenceBankingDetails = useMemo<OrganizerBankingDetails>(() => {
    if (!selectedConference?.bankingDetails) {
      return { verificationStatus: "Unverified" };
    }
    return {
      verificationStatus: "Unverified",
      ...selectedConference.bankingDetails,
    };
  }, [selectedConference]);
  const maskedAccountNumber = useMemo(() => {
    const accountNumber = (selectedConferenceBankingDetails.accountNumber || "").trim();
    if (!accountNumber) return "Not set";
    const last4 = accountNumber.slice(-4);
    return `****${last4}`;
  }, [selectedConferenceBankingDetails.accountNumber]);
  const bankingWarnings = useMemo(() => {
    const warnings: string[] = [];
    const details = selectedConferenceBankingDetails;
    if (!details.accountHolderName?.trim()) warnings.push("Account holder name is required.");
    if (!details.bankName?.trim()) warnings.push("Bank name is required.");
    if (!details.accountNumber?.trim()) warnings.push("Account number is required.");
    if (details.ifscCode && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(details.ifscCode.trim())) {
      warnings.push("IFSC format looks invalid.");
    }
    if (details.swiftCode && !/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/.test(details.swiftCode.trim())) {
      warnings.push("SWIFT/BIC format looks invalid.");
    }
    if (details.upiId && !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(details.upiId.trim())) {
      warnings.push("UPI ID format looks invalid.");
    }
    if (details.iban && !/^[A-Za-z0-9]{12,34}$/.test(details.iban.replace(/\s+/g, ""))) {
      warnings.push("IBAN format looks invalid.");
    }
    return warnings;
  }, [selectedConferenceBankingDetails]);
  const updateBankingDetails = (patch: Partial<OrganizerBankingDetails>) => {
    if (!selectedConference) return;
    const nextBankingDetails: OrganizerBankingDetails = {
      ...selectedConferenceBankingDetails,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    updateOrganizerConferenceConfig(selectedConference.id, { bankingDetails: nextBankingDetails });
    setBankingSaveStatus("Saved locally");
    setTimeout(() => setBankingSaveStatus(""), 1500);
  };
  const clearBankingDetails = () => {
    if (!selectedConference) return;
    if (!confirm("Clear all banking details for this conference?")) return;
    updateOrganizerConferenceConfig(selectedConference.id, {
      bankingDetails: { verificationStatus: "Unverified", updatedAt: new Date().toISOString() },
    });
    setBankingSaveStatus("Banking details cleared");
    setTimeout(() => setBankingSaveStatus(""), 1500);
  };

  const updateStatusEmailTemplateField = (
    templateKey: OrganizerStatusEmailTemplateKey,
    field: "subject" | "body",
    value: string
  ) => {
    if (!selectedConference || !selectedConferenceEmailTemplates) return;
    updateOrganizerConferenceConfig(selectedConference.id, {
      statusEmailTemplates: {
        ...selectedConferenceEmailTemplates,
        [templateKey]: {
          ...selectedConferenceEmailTemplates[templateKey],
          [field]: value,
        },
      },
    });
  };

  // Prevent SSR/client auth divergence from localStorage-backed state.
  if (!hydrated) return null;
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
                                  onClick={() => {
                                    setSelectedApplicantId(applicant.id);
                                    setApplicantProfileDrawerOpen(true);
                                  }}
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
                  </div>

                  <div className="card p-6 rounded-2xl mt-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                      <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Participants &amp; Allotments</h3>
                      <div className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        Showing {participantAllocationRows.length} of {selectedConference.applicants.length} participants
                      </div>
                    </div>
                    <div className="grid md:grid-cols-[1.4fr_180px_160px] gap-2 mb-4">
                      <input
                        className="input-base text-xs"
                        placeholder="Search by name, school, committee, country/member..."
                        value={participantSearchQuery}
                        onChange={(event) => setParticipantSearchQuery(event.target.value)}
                      />
                      <select
                        className="input-base text-xs"
                        value={participantStatusFilter}
                        onChange={(event) =>
                          setParticipantStatusFilter(
                            event.target.value as "all" | "Pending" | "Invited" | "Allotted" | "Waitlisted" | "Rejected"
                          )
                        }
                      >
                        <option value="all">All statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Invited">Invited</option>
                        <option value="Allotted">Allotted</option>
                        <option value="Waitlisted">Waitlisted</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                      <select
                        className="input-base text-xs"
                        value={participantSortKey}
                        onChange={(event) => setParticipantSortKey(event.target.value as "name" | "status" | "committee")}
                      >
                        <option value="name">Sort: Name</option>
                        <option value="status">Sort: Status</option>
                        <option value="committee">Sort: Committee</option>
                      </select>
                    </div>
                    {participantAllocationRows.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                        No participants matched your search/filter.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div
                          className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr_120px] gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold"
                          style={{ background: "var(--bg-subtle)", color: "var(--fg-muted)" }}
                        >
                          <span>Participant</span>
                          <span>Category</span>
                          <span>Committee</span>
                          <span>Country/Member</span>
                          <span>Status</span>
                        </div>
                        {participantAllocationRows.map((applicant) => (
                          <div
                            key={applicant.id}
                            className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr_120px] gap-2 px-3 py-2 rounded-lg text-xs"
                            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                          >
                            <div>
                              <p className="font-semibold" style={{ color: "var(--fg)" }}>{applicant.name}</p>
                              <p style={{ color: "var(--fg-muted)" }}>{applicant.school || "N/A"}</p>
                            </div>
                            <span style={{ color: "var(--fg-muted)" }}>{applicant.categoryName || "N/A"}</span>
                            <span style={{ color: "var(--fg-muted)" }}>{applicant.assignedCommitteeName || "Not allotted"}</span>
                            <span style={{ color: "var(--fg-muted)" }}>{applicant.assignedPortfolioName || "Not allotted"}</span>
                            <span style={{ color: "var(--fg-muted)" }}>{applicant.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card p-6 rounded-2xl mt-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                      <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Country Matrix</h3>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        {countryMatrixTotals.total} entries · {countryMatrixTotals.available} available · {countryMatrixTotals.allotted} allotted
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mb-4 flex-wrap text-xs">
                      <span className="px-2 py-1 rounded-full" style={{ background: "#f0fdf4", color: "#166534" }}>
                        Green = Available
                      </span>
                      <span className="px-2 py-1 rounded-full" style={{ background: "#fef2f2", color: "#991b1b" }}>
                        Red = Allotted / Full
                      </span>
                    </div>

                    <div className="grid md:grid-cols-[1.2fr_1fr_180px] gap-2 mb-4">
                      <input
                        className="input-base text-xs"
                        placeholder="Search country/member..."
                        value={countryMatrixSearch}
                        onChange={(event) => setCountryMatrixSearch(event.target.value)}
                      />
                      <select
                        className="input-base text-xs"
                        value={countryMatrixCommitteeFilter}
                        onChange={(event) => setCountryMatrixCommitteeFilter(event.target.value)}
                      >
                        <option value="all">All committees</option>
                        {selectedConference.committees.map((committee) => (
                          <option key={committee.id} value={committee.id}>{committee.name}</option>
                        ))}
                      </select>
                      <select
                        className="input-base text-xs"
                        value={countryMatrixSeatFilter}
                        onChange={(event) => setCountryMatrixSeatFilter(event.target.value as "all" | "available" | "allotted")}
                      >
                        <option value="all">All states</option>
                        <option value="available">Available</option>
                        <option value="allotted">Allotted / Full</option>
                      </select>
                    </div>

                    {countryMatrixGroups.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                        No matrix entries matched your filters.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {countryMatrixGroups.map((group) => (
                          <div
                            key={group.committeeId}
                            className="rounded-xl p-3"
                            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                          >
                            <div className="mb-2">
                              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{group.committeeName}</p>
                              <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>{group.committeeType}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.entries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="rounded-lg px-3 py-2 min-w-[180px]"
                                  style={
                                    entry.seatState === "available"
                                      ? { background: "#f0fdf4", border: "1px solid #86efac" }
                                      : { background: "#fef2f2", border: "1px solid #fca5a5" }
                                  }
                                >
                                  <p
                                    className="text-xs font-semibold"
                                    style={entry.seatState === "available" ? { color: "#166534" } : { color: "#991b1b" }}
                                  >
                                    {entry.name}
                                  </p>
                                  <p
                                    className="text-[11px]"
                                    style={entry.seatState === "available" ? { color: "#15803d" } : { color: "#b91c1c" }}
                                  >
                                    {entry.allottedCount}/{entry.seatCount} allotted · {entry.availableCount} available
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
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
                          {Array.from(new Set(selectedConference.committees.map((entry) => getCommitteeTypeLabel(entry)))).map((type) => (
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
                      <div className="mb-3 p-3 rounded-xl space-y-2" style={{ background: "var(--bg-subtle)" }}>
                        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Add Committee</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className="input-base text-xs"
                            placeholder="Committee name"
                            value={committeeDraft.name}
                            onChange={(event) => setCommitteeDraft((prev) => ({ ...prev, name: event.target.value }))}
                          />
                          <input
                            className="input-base text-xs"
                            placeholder="Seat count"
                            type="number"
                            value={committeeDraft.seatCount}
                            onChange={(event) => setCommitteeDraft((prev) => ({ ...prev, seatCount: event.target.value }))}
                          />
                          <select
                            className="input-base text-xs"
                            value={committeeDraft.committeeType}
                            onChange={(event) =>
                              setCommitteeDraft((prev) => ({
                                ...prev,
                                committeeType: event.target.value as "UN" | "NON_UN" | "CUSTOM",
                                members: [],
                                memberInput: "",
                              }))
                            }
                          >
                            <option value="UN">UN Committee</option>
                            <option value="NON_UN">Non-UN Committee</option>
                            <option value="CUSTOM">Custom Type</option>
                          </select>
                          <input
                            className="input-base text-xs"
                            placeholder="Agenda"
                            value={committeeDraft.agenda}
                            onChange={(event) => setCommitteeDraft((prev) => ({ ...prev, agenda: event.target.value }))}
                          />
                        </div>
                        {committeeDraft.committeeType === "CUSTOM" && (
                          <input
                            className="input-base text-xs"
                            placeholder="Custom type label (e.g. Lok Sabha)"
                            value={committeeDraft.customTypeLabel}
                            onChange={(event) => setCommitteeDraft((prev) => ({ ...prev, customTypeLabel: event.target.value }))}
                          />
                        )}
                        <div className="rounded-lg p-2 space-y-2" style={{ border: "1px solid var(--border)" }}>
                          <p className="text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                            {committeeDraft.committeeType === "UN" ? "Countries" : "Members"}
                          </p>
                          <div className="flex gap-2">
                            <input
                              className="input-base text-xs flex-1"
                              placeholder={`Add ${memberLabelForType(committeeDraft.committeeType)}`}
                              value={committeeDraft.memberInput}
                              onChange={(event) =>
                                setCommitteeDraft((prev) => ({ ...prev, memberInput: event.target.value }))
                              }
                            />
                            <button className="btn btn-ghost text-xs" onClick={addDraftMember}>
                              Add
                            </button>
                          </div>
                          {committeeDraft.committeeType === "UN" && (
                            <div className="rounded-lg p-2 space-y-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                              <div className="flex items-center gap-2">
                                <select
                                  className="input-base text-xs"
                                  value={createTemplateSelection}
                                  onChange={(event) => setCreateTemplateSelection(event.target.value as UnTemplateKey)}
                                >
                                  {Object.keys(UN_TEMPLATE_COUNTRIES).map((templateKey) => (
                                    <option key={templateKey} value={templateKey}>{templateKey}</option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn-ghost text-xs"
                                  onClick={() => importTemplateIntoCreateDraft(createTemplateSelection)}
                                >
                                  Import Template (Append)
                                </button>
                              </div>
                              <p className="text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                                UN Countries (193)
                              </p>
                              <div className="max-h-52 overflow-y-auto pr-1 space-y-1">
                                {UN_COUNTRY_NAMES.map((country) => {
                                  const alreadyAdded = committeeDraft.members.some(
                                    (member) => member.name.trim().toLowerCase() === country.toLowerCase()
                                  );
                                  return (
                                    <div key={country} className="flex items-center justify-between rounded-md px-2 py-1" style={{ background: "var(--bg-subtle)" }}>
                                      <span className="text-xs" style={{ color: "var(--fg)" }}>{country}</span>
                                      <button
                                        className="btn btn-ghost text-xs"
                                        onClick={() => addUnCountryFromList(country)}
                                        disabled={alreadyAdded}
                                        style={{ opacity: alreadyAdded ? 0.5 : 1 }}
                                      >
                                        {alreadyAdded ? "Added" : "Add"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {committeeDraft.members.length === 0 ? (
                            <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                              {committeeDraft.committeeType === "UN"
                                ? "Add countries manually or from the UN list."
                                : "Add custom members for this committee."}
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                              {committeeDraft.members.map((member) => (
                                <div key={member.id} className="grid grid-cols-[1fr_88px_56px] gap-2">
                                  <input
                                    className="input-base text-xs"
                                    value={member.name}
                                    onChange={(event) => updateDraftMember(member.id, { name: event.target.value })}
                                  />
                                  <input
                                    className="input-base text-xs"
                                    type="number"
                                    min={1}
                                    value={member.seatCount}
                                    onChange={(event) => updateDraftMember(member.id, { seatCount: event.target.value })}
                                  />
                                  <button
                                    className="btn btn-ghost text-xs"
                                    onClick={() => removeDraftMember(member.id)}
                                    style={{ color: "#dc2626" }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-primary text-xs"
                          onClick={() => {
                            if (!committeeDraft.name.trim() || !committeeDraft.agenda.trim()) return;
                            const seats = Number(committeeDraft.seatCount);
                            if (!Number.isFinite(seats) || seats <= 0) return;
                            const normalizedMembers = committeeDraft.members
                              .map((member, index) => ({
                                id: member.id || `pf-${Date.now()}-${index}`,
                                name: member.name.trim(),
                                seatCount: Number(member.seatCount) > 0 ? Number(member.seatCount) : 1,
                                assignedApplicantIds: [] as string[],
                              }))
                              .filter((member) => member.name);
                            addOrganizerCommittee(selectedConference.id, {
                              name: committeeDraft.name.trim(),
                              agenda: committeeDraft.agenda.trim(),
                              committeeType: committeeDraft.committeeType,
                              memberMode: memberModeForType(committeeDraft.committeeType),
                              customTypeLabel:
                                committeeDraft.committeeType === "CUSTOM"
                                  ? committeeDraft.customTypeLabel.trim() || undefined
                                  : undefined,
                              type:
                                committeeDraft.committeeType === "UN"
                                  ? "UN"
                                  : committeeDraft.committeeType === "NON_UN"
                                    ? "Non-UN"
                                    : committeeDraft.customTypeLabel.trim() || "Custom",
                              seatCount: seats,
                              isPublic: true,
                              customQuestions: [],
                              portfolios: normalizedMembers,
                            });
                            setCommitteeDraft({
                              name: "",
                              agenda: "",
                              seatCount: "",
                              committeeType: "UN",
                              customTypeLabel: "",
                              members: [],
                              memberInput: "",
                            });
                          }}
                        >
                          Add Committee
                        </button>
                      </div>
                      <div className="space-y-3">
                        {selectedConference.committees
                          .filter((committee) => matrixCommitteeType === "all" || getCommitteeTypeLabel(committee) === matrixCommitteeType)
                          .map((committee) => (
                          <div key={committee.id} className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                            {committee.logoImageUrl && (
                              <div className="mb-2 h-20 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${committee.logoImageUrl}")` }} />
                            )}
                            <p className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{committee.name}</p>
                            {committee.description && (
                              <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{committee.description}</p>
                            )}
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{committee.agenda}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              Seats: {committee.seatCount} · Allotted: {committee.allottedCount ?? 0} · Available: {committee.seatCount - (committee.allottedCount ?? 0)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              Type: {getCommitteeTypeLabel(committee)} · Chair: {committee.chairName || "TBA"} · Visibility: {committee.isPublic === false ? "Private" : "Public"}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              Mode: {committee.memberMode === "UN_COUNTRY" ? "UN Countries" : "Custom Members"}
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
                                <p className="text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                                  {committee.memberMode === "UN_COUNTRY" ? "Countries" : "Members"}
                                </p>
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
                            <button className="btn btn-ghost text-xs mt-2" onClick={() => openDetailsEditor(committee)}>
                              Edit Details
                            </button>
                            <button
                              className="btn btn-ghost text-xs mt-2"
                              onClick={() => openCountryEditor(committee)}
                            >
                              {committee.memberMode === "UN_COUNTRY" || committee.committeeType === "UN"
                                ? "Edit Countries"
                                : "Edit Members"}
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
                            <button
                              className="btn btn-ghost text-xs mt-2"
                              style={{ color: "#dc2626" }}
                              onClick={() => tryDeleteCommittee(selectedConference, committee)}
                            >
                              Delete Committee
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
                          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                            <input
                              className="input-base text-xs"
                              placeholder="Search name, category, committee..."
                              value={transactionSearchQuery}
                              onChange={(event) => setTransactionSearchQuery(event.target.value)}
                            />
                            <select
                              className="input-base text-xs"
                              value={transactionPaymentFilter}
                              onChange={(event) => setTransactionPaymentFilter(event.target.value as "all" | "paid" | "pending")}
                            >
                              <option value="all">All payment states</option>
                              <option value="paid">Paid</option>
                              <option value="pending">Pending</option>
                            </select>
                            <select
                              className="input-base text-xs"
                              value={transactionRefundFilter}
                              onChange={(event) => setTransactionRefundFilter(event.target.value as "all" | "active" | "refunded")}
                            >
                              <option value="all">All refund states</option>
                              <option value="active">Active</option>
                              <option value="refunded">Refunded</option>
                            </select>
                            <select
                              className="input-base text-xs"
                              value={transactionApplicantStatusFilter}
                              onChange={(event) =>
                                setTransactionApplicantStatusFilter(
                                  event.target.value as "all" | "Pending" | "Invited" | "Allotted" | "Waitlisted" | "Rejected"
                                )
                              }
                            >
                              <option value="all">All applicant statuses</option>
                              <option value="Pending">Pending</option>
                              <option value="Invited">Invited</option>
                              <option value="Allotted">Allotted</option>
                              <option value="Waitlisted">Waitlisted</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </div>
                          <p className="text-[11px] mb-2" style={{ color: "var(--fg-muted)" }}>
                            Showing {transactionRows.length} of {selectedConference.applicants.length} transactions
                          </p>
                          <div className="space-y-2 max-h-72 overflow-y-auto">
                            {transactionRows.length === 0 ? (
                              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                No transactions matched your filters.
                              </p>
                            ) : (
                              transactionRows.map((row) => (
                                <div
                                  key={row.id}
                                  className="p-3 rounded-lg"
                                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{row.name}</p>
                                      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                                        {row.category} · Registered: {row.registeredAt}
                                      </p>
                                      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                                        Committee: {row.committee} · Country/Member: {row.portfolio}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>${row.amount}</p>
                                      <div className="flex gap-1 justify-end mt-1 flex-wrap">
                                        <span className={`badge ${row.paymentStatus === "Paid" ? "badge-green" : "badge-gold"}`}>
                                          {row.paymentStatus}
                                        </span>
                                        <span className={`badge ${
                                          row.applicantStatus === "Allotted"
                                            ? "badge-green"
                                            : row.applicantStatus === "Rejected"
                                              ? "badge-gray"
                                              : row.applicantStatus === "Waitlisted"
                                                ? "badge-gold"
                                                : "badge-blue"
                                        }`}>
                                          {row.applicantStatus}
                                        </span>
                                        <span className={`badge ${row.refundStatus === "Refunded" ? "badge-gray" : "badge-blue"}`}>
                                          {row.refundStatus}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex justify-end mt-2">
                                    <button
                                      className="btn btn-ghost text-xs"
                                      disabled={!row.paid}
                                      onClick={() =>
                                        setRefundedApplicantIds((prev) => ({
                                          ...prev,
                                          [row.id]: !prev[row.id],
                                        }))
                                      }
                                    >
                                      {refundedApplicantIds[row.id] ? "Undo Refund" : "Refund"}
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
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
                        <div className="p-3 rounded-xl space-y-2" style={{ background: "var(--bg-subtle)" }}>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>
                              Banking Details (Payout Account)
                            </p>
                            <button className="btn btn-ghost text-xs" style={{ color: "#dc2626" }} onClick={clearBankingDetails}>
                              Clear
                            </button>
                          </div>
                          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                            Account: {maskedAccountNumber} · Verification: {selectedConferenceBankingDetails.verificationStatus || "Unverified"}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                            Last updated: {selectedConferenceBankingDetails.updatedAt || "Not updated yet"}
                            {bankingSaveStatus ? ` · ${bankingSaveStatus}` : ""}
                          </p>

                          <p className="text-xs font-semibold mt-2" style={{ color: "var(--fg)" }}>Account Info</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className="input-base text-xs"
                              placeholder="Account holder name"
                              value={selectedConferenceBankingDetails.accountHolderName || ""}
                              onChange={(event) => updateBankingDetails({ accountHolderName: event.target.value.trimStart() })}
                            />
                            <input
                              className="input-base text-xs"
                              placeholder="Bank name"
                              value={selectedConferenceBankingDetails.bankName || ""}
                              onChange={(event) => updateBankingDetails({ bankName: event.target.value.trimStart() })}
                            />
                            <input
                              className="input-base text-xs"
                              placeholder="Account number"
                              value={selectedConferenceBankingDetails.accountNumber || ""}
                              onChange={(event) => updateBankingDetails({ accountNumber: event.target.value.trim() })}
                            />
                            <select
                              className="input-base text-xs"
                              value={selectedConferenceBankingDetails.accountType || "Savings"}
                              onChange={(event) =>
                                updateBankingDetails({
                                  accountType: event.target.value as "Savings" | "Current" | "Checking" | "Other",
                                })
                              }
                            >
                              <option value="Savings">Savings</option>
                              <option value="Current">Current</option>
                              <option value="Checking">Checking</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <p className="text-xs font-semibold mt-2" style={{ color: "var(--fg)" }}>Bank & Branch Info</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className="input-base text-xs"
                              placeholder="IFSC code"
                              value={selectedConferenceBankingDetails.ifscCode || ""}
                              onChange={(event) => updateBankingDetails({ ifscCode: event.target.value.trim().toUpperCase() })}
                            />
                            <input
                              className="input-base text-xs"
                              placeholder="Routing number"
                              value={selectedConferenceBankingDetails.routingNumber || ""}
                              onChange={(event) => updateBankingDetails({ routingNumber: event.target.value.trim() })}
                            />
                            <input
                              className="input-base text-xs"
                              placeholder="Branch name"
                              value={selectedConferenceBankingDetails.branchName || ""}
                              onChange={(event) => updateBankingDetails({ branchName: event.target.value.trimStart() })}
                            />
                            <input
                              className="input-base text-xs"
                              placeholder="Branch address"
                              value={selectedConferenceBankingDetails.branchAddress || ""}
                              onChange={(event) => updateBankingDetails({ branchAddress: event.target.value.trimStart() })}
                            />
                          </div>

                          <p className="text-xs font-semibold mt-2" style={{ color: "var(--fg)" }}>International / Alternate</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className="input-base text-xs"
                              placeholder="SWIFT / BIC"
                              value={selectedConferenceBankingDetails.swiftCode || ""}
                              onChange={(event) => updateBankingDetails({ swiftCode: event.target.value.trim().toUpperCase() })}
                            />
                            <input
                              className="input-base text-xs"
                              placeholder="IBAN"
                              value={selectedConferenceBankingDetails.iban || ""}
                              onChange={(event) => updateBankingDetails({ iban: event.target.value.trim().toUpperCase() })}
                            />
                            <input
                              className="input-base text-xs"
                              placeholder="UPI ID"
                              value={selectedConferenceBankingDetails.upiId || ""}
                              onChange={(event) => updateBankingDetails({ upiId: event.target.value.trim() })}
                            />
                            <select
                              className="input-base text-xs"
                              value={selectedConferenceBankingDetails.verificationStatus || "Unverified"}
                              onChange={(event) =>
                                updateBankingDetails({
                                  verificationStatus: event.target.value as "Unverified" | "Pending" | "Verified",
                                })
                              }
                            >
                              <option value="Unverified">Unverified</option>
                              <option value="Pending">Pending</option>
                              <option value="Verified">Verified</option>
                            </select>
                            <textarea
                              className="input-base text-xs col-span-2"
                              rows={2}
                              placeholder="Payout notes"
                              value={selectedConferenceBankingDetails.payoutNotes || ""}
                              onChange={(event) => updateBankingDetails({ payoutNotes: event.target.value })}
                            />
                          </div>
                          {bankingWarnings.length > 0 && (
                            <div className="rounded-lg p-2" style={{ background: "#fffbeb", border: "1px solid #fcd34d" }}>
                              {bankingWarnings.map((warning) => (
                                <p key={warning} className="text-[11px]" style={{ color: "#92400e" }}>
                                  {warning}
                                </p>
                              ))}
                            </div>
                          )}
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
                            <p className="text-[11px] mt-1" style={{ color: "var(--fg-muted)" }}>
                              Pricing and questions in this card apply to this category&apos;s application form.
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
                            <div className="rounded-lg p-3 mt-3 space-y-2" style={{ background: "var(--bg)" }}>
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Category Pricing</p>
                                <button
                                  className="btn btn-ghost text-xs"
                                  onClick={() => addCategoryPricingPhase(selectedConference.id, category)}
                                >
                                  + Add Phase
                                </button>
                              </div>
                              <div className="grid md:grid-cols-2 gap-2">
                                <label className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                  Base Price
                                  <input
                                    className="input-base text-xs mt-1"
                                    type="number"
                                    min={0}
                                    value={category.basePrice}
                                    onChange={(event) =>
                                      updateCategoryBasePrice(selectedConference.id, category.id, event.target.value)
                                    }
                                  />
                                </label>
                              </div>
                              {category.pricingPhases.length === 0 ? (
                                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                  No pricing phases yet. Add one if you want date-based prices.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {category.pricingPhases.map((phase) => (
                                    <div key={phase.id} className="rounded-lg p-2" style={{ border: "1px solid var(--border)" }}>
                                      <div className="grid md:grid-cols-4 gap-2">
                                        <input
                                          className="input-base text-xs"
                                          placeholder="Phase name"
                                          value={phase.name}
                                          onChange={(event) =>
                                            updateCategoryPricingPhase(selectedConference.id, category, phase.id, {
                                              name: event.target.value,
                                            })
                                          }
                                        />
                                        <input
                                          className="input-base text-xs"
                                          type="date"
                                          value={phase.startDate}
                                          onChange={(event) =>
                                            updateCategoryPricingPhase(selectedConference.id, category, phase.id, {
                                              startDate: event.target.value,
                                            })
                                          }
                                        />
                                        <input
                                          className="input-base text-xs"
                                          type="date"
                                          value={phase.endDate}
                                          onChange={(event) =>
                                            updateCategoryPricingPhase(selectedConference.id, category, phase.id, {
                                              endDate: event.target.value,
                                            })
                                          }
                                        />
                                        <input
                                          className="input-base text-xs"
                                          type="number"
                                          min={0}
                                          value={phase.basePrice}
                                          onChange={(event) =>
                                            updateCategoryPricingPhase(selectedConference.id, category, phase.id, {
                                              basePrice: Math.max(0, Number(event.target.value) || 0),
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="flex justify-end mt-2">
                                        <button
                                          className="btn btn-ghost text-xs"
                                          style={{ color: "#dc2626" }}
                                          onClick={() => removeCategoryPricingPhase(selectedConference.id, category, phase.id)}
                                        >
                                          Remove Phase
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="rounded-lg p-3 mt-3 space-y-2" style={{ background: "var(--bg)" }}>
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Application Questions</p>
                                <button
                                  className="btn btn-ghost text-xs"
                                  onClick={() => addCategoryQuestion(selectedConference.id, category)}
                                >
                                  + Add Question
                                </button>
                              </div>
                              {category.formFields.length === 0 ? (
                                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                  No custom questions yet.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {category.formFields.map((field) => (
                                    <div key={field.id} className="rounded-lg p-2 space-y-2" style={{ border: "1px solid var(--border)" }}>
                                      <input
                                        className="input-base text-xs"
                                        placeholder="Question label"
                                        value={field.label}
                                        onChange={(event) =>
                                          updateCategoryQuestion(selectedConference.id, category, field.id, {
                                            label: event.target.value,
                                          })
                                        }
                                      />
                                      <div className="grid md:grid-cols-3 gap-2">
                                        <select
                                          className="input-base text-xs"
                                          value={field.type}
                                          onChange={(event) =>
                                            updateCategoryQuestion(selectedConference.id, category, field.id, {
                                              type: event.target.value as "text" | "textarea" | "select" | "number" | "date" | "checkbox",
                                            })
                                          }
                                        >
                                          <option value="text">Text</option>
                                          <option value="textarea">Long Text</option>
                                          <option value="number">Number</option>
                                          <option value="date">Date</option>
                                          <option value="checkbox">Checkbox (Yes/No)</option>
                                          <option value="select">Dropdown</option>
                                        </select>
                                        <input
                                          className="input-base text-xs"
                                          placeholder="Placeholder (optional)"
                                          value={field.placeholder || ""}
                                          onChange={(event) =>
                                            updateCategoryQuestion(selectedConference.id, category, field.id, {
                                              placeholder: event.target.value,
                                            })
                                          }
                                        />
                                        <label className="flex items-center gap-2 text-xs px-2" style={{ color: "var(--fg-muted)" }}>
                                          <input
                                            type="checkbox"
                                            checked={field.required}
                                            onChange={(event) =>
                                              updateCategoryQuestion(selectedConference.id, category, field.id, {
                                                required: event.target.checked,
                                              })
                                            }
                                          />
                                          Required
                                        </label>
                                      </div>
                                      {field.type === "select" && (
                                        <input
                                          className="input-base text-xs"
                                          placeholder="Options (comma-separated)"
                                          value={(field.options || []).join(", ")}
                                          onChange={(event) =>
                                            updateCategoryQuestion(selectedConference.id, category, field.id, {
                                              options: event.target.value
                                                .split(",")
                                                .map((option) => option.trim())
                                                .filter(Boolean),
                                            })
                                          }
                                        />
                                      )}
                                      <div className="flex justify-end">
                                        <button
                                          className="btn btn-ghost text-xs"
                                          style={{ color: "#dc2626" }}
                                          onClick={() => removeCategoryQuestion(selectedConference.id, category, field.id)}
                                        >
                                          Remove Question
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card p-6 rounded-2xl mt-6">
                    <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Status Email Templates</h3>
                    <p className="text-xs mb-3" style={{ color: "var(--fg-muted)" }}>
                      These emails are sent automatically when an applicant is marked as Allotted, Rejected, Waitlisted, or Invited.
                    </p>
                    <div className="grid md:grid-cols-[180px_1fr] gap-3">
                      <select
                        className="input-base text-xs"
                        value={selectedStatusEmailTemplate}
                        onChange={(event) =>
                          setSelectedStatusEmailTemplate(event.target.value as OrganizerStatusEmailTemplateKey)
                        }
                      >
                        <option value="allotted">Accepted / Allotted</option>
                        <option value="rejected">Rejected</option>
                        <option value="waitlisted">Waitlisted</option>
                        <option value="invited">Invited</option>
                      </select>
                      <div className="space-y-2">
                        <input
                          className="input-base text-xs"
                          placeholder="Email subject"
                          value={selectedConferenceEmailTemplates?.[selectedStatusEmailTemplate]?.subject || ""}
                          onChange={(event) =>
                            updateStatusEmailTemplateField(selectedStatusEmailTemplate, "subject", event.target.value)
                          }
                        />
                        <textarea
                          className="input-base text-xs"
                          rows={8}
                          placeholder="Email body"
                          value={selectedConferenceEmailTemplates?.[selectedStatusEmailTemplate]?.body || ""}
                          onChange={(event) =>
                            updateStatusEmailTemplateField(selectedStatusEmailTemplate, "body", event.target.value)
                          }
                        />
                        <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                          Placeholders: {`{{applicantName}}`}, {`{{conferenceTitle}}`}, {`{{status}}`}, {`{{assignedCommittee}}`}, {`{{assignedPortfolio}}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <QrScannerPanel />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {applicantProfileDrawerOpen && selectedApplicant && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex justify-end">
          <div
            className="w-full max-w-2xl h-full overflow-y-auto p-5"
            style={{ background: "var(--bg)", borderLeft: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
                  Student Profile
                </h3>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {selectedApplicant.name}
                </p>
              </div>
              <button
                className="btn btn-ghost text-xs"
                onClick={() => {
                  setApplicantProfileDrawerOpen(false);
                  setSelectedApplicantId("");
                }}
              >
                Close
              </button>
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Basic Profile</p>
              <div className="grid md:grid-cols-2 gap-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                <p><strong style={{ color: "var(--fg)" }}>Name:</strong> {selectedApplicant.name || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Email:</strong> {selectedApplicant.userEmail || selectedApplicantUserProfile?.email || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>School:</strong> {selectedApplicant.school || selectedApplicantUserProfile?.school || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Country:</strong> {selectedApplicant.countryPreference || selectedApplicantUserProfile?.country || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Category:</strong> {selectedApplicant.categoryName || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Status:</strong> {selectedApplicant.status}</p>
                <p><strong style={{ color: "var(--fg)" }}>Payment:</strong> {selectedApplicant.paid ? "Paid" : "Unpaid"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Amount:</strong> {typeof selectedApplicant.amount === "number" ? `$${selectedApplicant.amount}` : "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Assigned Committee:</strong> {selectedApplicant.assignedCommitteeName || "Not assigned"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Assigned Portfolio:</strong> {selectedApplicant.assignedPortfolioName || "Not assigned"}</p>
              </div>
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>MUN Profile Summary</p>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                <strong style={{ color: "var(--fg)" }}>Experience:</strong> {selectedApplicantUserProfile?.munExperienceSummary || "No MUN experience summary available."}
              </p>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                <strong style={{ color: "var(--fg)" }}>Awards:</strong> {selectedApplicantUserProfile?.munAwardsSummary || "No MUN awards summary available."}
              </p>
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>MUN Participations</p>
              {selectedApplicantParticipationList.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No participation records available.</p>
              ) : (
                <div className="space-y-2">
                  {selectedApplicantParticipationList.map((participation) => (
                    <div key={participation.id} className="rounded-lg p-2 text-xs" style={{ background: "var(--bg)" }}>
                      <p style={{ color: "var(--fg)" }}><strong>{participation.conferenceName}</strong></p>
                      <p style={{ color: "var(--fg-muted)" }}>
                        {participation.role || "Delegate"}{participation.committee ? ` · ${participation.committee}` : ""}{participation.year ? ` · ${participation.year}` : ""}
                      </p>
                      {participation.countryRepresented && (
                        <p style={{ color: "var(--fg-muted)" }}>Represented: {participation.countryRepresented}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>MUN Awards</p>
              {selectedApplicantAwardsList.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No award records available.</p>
              ) : (
                <div className="space-y-2">
                  {selectedApplicantAwardsList.map((award) => (
                    <div key={award.id} className="rounded-lg p-2 text-xs" style={{ background: "var(--bg)" }}>
                      <p style={{ color: "var(--fg)" }}><strong>{award.title}</strong></p>
                      <p style={{ color: "var(--fg-muted)" }}>
                        {award.conferenceName}{award.category ? ` · ${award.category}` : ""}{award.committee ? ` · ${award.committee}` : ""}{award.year ? ` · ${award.year}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Submitted Answers</p>
              {selectedApplicantResponses.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No submitted responses found.</p>
              ) : (
                <div className="space-y-2">
                  {selectedApplicantResponses.map(([key, value]) => (
                    <div key={key} className="rounded-lg p-2 text-xs" style={{ background: "var(--bg)" }}>
                      <p className="font-semibold" style={{ color: "var(--fg)" }}>{formatResponseLabel(key)}</p>
                      <p style={{ color: "var(--fg-muted)" }}>
                        {typeof value === "boolean" ? (value ? "Yes" : "No") : value === null || value === undefined || value === "" ? "N/A" : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {countryEditorOpen && selectedConference && selectedCountryEditorCommittee && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex justify-end">
          <div
            className="w-full max-w-xl h-full overflow-y-auto p-5"
            style={{ background: "var(--bg)", borderLeft: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
                  {(selectedCountryEditorCommittee.memberMode === "UN_COUNTRY" || selectedCountryEditorCommittee.committeeType === "UN")
                    ? "Edit Countries"
                    : "Edit Members"}
                </h3>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {selectedCountryEditorCommittee.name}
                </p>
              </div>
              <button className="btn btn-ghost text-xs" onClick={() => setCountryEditorOpen(false)}>
                Close
              </button>
            </div>

            <div className="rounded-xl p-3 mb-4" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--fg)" }}>
                {(selectedCountryEditorCommittee.memberMode === "UN_COUNTRY" || selectedCountryEditorCommittee.committeeType === "UN")
                  ? "Current Countries"
                  : "Current Members"}
              </p>
              {countryEditorDraftCountries.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No countries added yet.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {countryEditorDraftCountries.map((country) => (
                    <div key={country.id} className="flex items-center justify-between rounded-lg px-2 py-1" style={{ background: "var(--bg)" }}>
                      <span className="text-xs" style={{ color: "var(--fg)" }}>{country.name}</span>
                      <button
                        className="btn btn-ghost text-xs"
                        onClick={() => removeCountryFromEditor(country.id)}
                        style={{ color: "#dc2626" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl p-3 mb-4" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--fg)" }}>
                {(selectedCountryEditorCommittee.memberMode === "UN_COUNTRY" || selectedCountryEditorCommittee.committeeType === "UN")
                  ? "Add Country Manually"
                  : "Add Member Manually"}
              </p>
              <div className="flex gap-2">
                <input
                  className="input-base text-xs flex-1"
                  placeholder={
                    (selectedCountryEditorCommittee.memberMode === "UN_COUNTRY" || selectedCountryEditorCommittee.committeeType === "UN")
                      ? "Country name"
                      : "Member name"
                  }
                  value={countryEditorManualInput}
                  onChange={(event) => setCountryEditorManualInput(event.target.value)}
                />
                <button className="btn btn-ghost text-xs" onClick={() => addCountryToEditor(countryEditorManualInput)}>
                  Add
                </button>
              </div>
            </div>

            {(selectedCountryEditorCommittee.memberMode === "UN_COUNTRY" || selectedCountryEditorCommittee.committeeType === "UN") && (
              <div className="rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <select
                    className="input-base text-xs"
                    value={editorTemplateSelection}
                    onChange={(event) => setEditorTemplateSelection(event.target.value as UnTemplateKey)}
                  >
                    {Object.keys(UN_TEMPLATE_COUNTRIES).map((templateKey) => (
                      <option key={templateKey} value={templateKey}>{templateKey}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => importTemplateIntoEditor(editorTemplateSelection)}
                  >
                    Import Template (Append)
                  </button>
                </div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--fg)" }}>UN Countries List</p>
                <input
                  className="input-base text-xs mb-2"
                  placeholder="Search countries..."
                  value={countryEditorSearch}
                  onChange={(event) => setCountryEditorSearch(event.target.value)}
                />
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {UN_COUNTRY_NAMES.filter((country) =>
                    country.toLowerCase().includes(countryEditorSearch.trim().toLowerCase())
                  ).map((country) => {
                    const alreadyAdded = countryEditorDraftCountries.some(
                      (entry) => entry.name.trim().toLowerCase() === country.toLowerCase()
                    );
                    return (
                      <div key={country} className="flex items-center justify-between rounded-md px-2 py-1" style={{ background: "var(--bg)" }}>
                        <span className="text-xs" style={{ color: "var(--fg)" }}>{country}</span>
                        <button
                          className="btn btn-ghost text-xs"
                          onClick={() => addCountryToEditor(country)}
                          disabled={alreadyAdded}
                          style={{ opacity: alreadyAdded ? 0.5 : 1 }}
                        >
                          {alreadyAdded ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button className="btn btn-ghost flex-1" onClick={() => setCountryEditorOpen(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={() => saveCountryEditor(selectedConference.id)}>
                {(selectedCountryEditorCommittee.memberMode === "UN_COUNTRY" || selectedCountryEditorCommittee.committeeType === "UN")
                  ? "Save Countries"
                  : "Save Members"}
              </button>
            </div>
          </div>
        </div>
      )}
      {detailsEditorOpen && selectedConference && selectedDetailsEditorCommittee && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex justify-end">
          <div
            className="w-full max-w-xl h-full overflow-y-auto p-5"
            style={{ background: "var(--bg)", borderLeft: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Edit Committee Details</h3>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{selectedDetailsEditorCommittee.name}</p>
              </div>
              <button className="btn btn-ghost text-xs" onClick={() => setDetailsEditorOpen(false)}>
                Close
              </button>
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Basics</p>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg-muted)" }}>Committee Title</p>
              <input
                className="input-base text-sm"
                placeholder="Committee name"
                value={detailsEditorDraft.name}
                onChange={(event) => setDetailsEditorDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg-muted)" }}>Description</p>
              <textarea
                className="input-base text-sm"
                rows={3}
                placeholder="Description"
                value={detailsEditorDraft.description}
                onChange={(event) => setDetailsEditorDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg-muted)" }}>Agenda</p>
              <textarea
                className="input-base text-sm"
                rows={2}
                placeholder="Agenda"
                value={detailsEditorDraft.agenda}
                onChange={(event) => setDetailsEditorDraft((prev) => ({ ...prev, agenda: event.target.value }))}
              />
              </div>
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Committee Logo</p>
              <input
                className="input-base text-sm"
                placeholder="Logo URL"
                value={detailsEditorDraft.logoImageUrl}
                onChange={(event) => setDetailsEditorDraft((prev) => ({ ...prev, logoImageUrl: event.target.value }))}
              />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onCommitteeLogoFileSelected}
                className="input-base text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white"
              />
              {detailsEditorDraft.logoImageUrl && (
                <div className="rounded-lg h-24 bg-cover bg-center" style={{ backgroundImage: `url("${detailsEditorDraft.logoImageUrl}")` }} />
              )}
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Chairs</p>
                <button className="btn btn-ghost text-xs" onClick={addChairDraftRow}>+ Add Chair</button>
              </div>
              {detailsEditorDraft.chairs.length === 0 && (
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No chairs added yet.</p>
              )}
              <div className="space-y-2">
                {detailsEditorDraft.chairs.map((chair) => (
                  <div key={chair.id} className="grid grid-cols-[1fr_1fr_80px] gap-2">
                    <input
                      className="input-base text-xs"
                      placeholder="Chair name"
                      value={chair.name}
                      onChange={(event) => updateChairDraftRow(chair.id, { name: event.target.value })}
                    />
                    <input
                      className="input-base text-xs"
                      placeholder="Chair email"
                      value={chair.email}
                      onChange={(event) => updateChairDraftRow(chair.id, { email: event.target.value })}
                    />
                    <button
                      className="btn btn-ghost text-xs"
                      style={{ color: "#dc2626" }}
                      onClick={() => removeChairDraftRow(chair.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button className="btn btn-ghost flex-1" onClick={() => setDetailsEditorOpen(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={() => saveCommitteeDetails(selectedConference.id)}>
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
