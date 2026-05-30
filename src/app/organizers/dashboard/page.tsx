"use client";

import { ChangeEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppRouteSkeleton from "@/components/AppRouteSkeleton";
import QrScannerPanel from "@/components/QrScannerPanel";
import { ensureServerSession } from "@/lib/client/session";
import { useAuth } from "@/lib/auth-context";
import { hasOrganizerConferenceAccess } from "@/lib/organizer-access";
import {
  OrganizerBankingDetails,
  OrganizerConference,
  OrganizerDocument,
  OrganizerDocumentCategory,
  OrganizerStatusEmailTemplateKey,
} from "@/lib/types";
import { getActivePhase } from "@/lib/pricing";
import { canAccessSuperDashboard, SUPER_ADMIN_HREF, SUPER_ADMIN_LABEL } from "@/lib/admin-nav";

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
  startDate: conference?.startDate || "",
  endDate: conference?.endDate || "",
  description: conference?.description || "",
  termsAndConditions: conference?.termsAndConditions || "",
  refundPolicy: conference?.refundPolicy || "",
  codeOfConduct: conference?.codeOfConduct || "",
  faqNotes: conference?.faqNotes || "",
  logoImageUrl: conference?.logoImageUrl || "",
  bannerImageUrl: conference?.bannerImageUrl || "",
  website: conference?.socialLinks?.website || "",
  instagram: conference?.socialLinks?.instagram || "",
  linkedin: conference?.socialLinks?.linkedin || "",
  twitter: conference?.socialLinks?.twitter || "",
  tags: (conference?.tags || []).join(", "),
  capacity: conference?.capacity || 0,
  level: conference?.level || "Open",
  whatIsIncluded: (conference?.whatIsIncluded || []).join("\n"),
});

const normalizeScheduleEntries = (
  raw: unknown
): Array<{ id: string; day: string; fromTime: string; toTime: string; title: string }> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      const item = entry as Record<string, unknown>;
      return {
        id: String(item.id || `schedule-${Date.now()}-${index}`),
        day: String(item.day || ""),
        fromTime: String(item.fromTime || ""),
        toTime: String(item.toTime || ""),
        title: String(item.title || ""),
      };
    })
    .filter((item) => item.day && item.fromTime && item.toTime && item.title);
};

const groupScheduleByDay = (
  entries: Array<{ id: string; day: string; fromTime: string; toTime: string; title: string }>
) => {
  const dayOrder: string[] = [];
  const grouped = new Map<string, Array<{ id: string; day: string; fromTime: string; toTime: string; title: string }>>();
  entries.forEach((entry) => {
    const dayName = entry.day.trim() || "Day";
    if (!grouped.has(dayName)) {
      grouped.set(dayName, []);
      dayOrder.push(dayName);
    }
    grouped.get(dayName)?.push(entry);
  });
  return dayOrder.map((dayName) => ({ dayName, events: grouped.get(dayName) || [] }));
};

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

type PartnerRelationship = {
  id: string;
  sourceEventId: string;
  targetEventId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  direction: "incoming" | "outgoing";
  partnerEvent: { id: string; title: string };
};

type DocumentDraft = {
  title: string;
  category: OrganizerDocumentCategory;
  sourceType: "upload" | "url";
  url: string;
  fileName?: string;
  mimeType?: string;
};

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

type OrganizerSectionId =
  | "overview"
  | "conferences"
  | "preview"
  | "applications"
  | "participants"
  | "committees"
  | "pricing"
  | "transactions"
  | "communications"
  | "awards"
  | "team"
  | "cameraCheckIn"
  | "settings";

type OrganizerNavItem = {
  id: OrganizerSectionId;
  label: string;
  icon: string;
  scope: "global" | "conference";
};

type OrganizerNavGroup = {
  label: string;
  items: OrganizerNavItem[];
};

const ORGANIZER_NAV: OrganizerNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { id: "overview", label: "Overview", icon: "◎", scope: "global" },
      { id: "conferences", label: "Conferences", icon: "▤", scope: "global" },
    ],
  },
  {
    label: "This conference",
    items: [
      { id: "preview", label: "Preview & Content", icon: "▣", scope: "conference" },
      { id: "applications", label: "Applications", icon: "◉", scope: "conference" },
      { id: "participants", label: "Participants", icon: "◈", scope: "conference" },
      { id: "committees", label: "Committees", icon: "◇", scope: "conference" },
      { id: "pricing", label: "Categories & Pricing", icon: "◆", scope: "conference" },
      { id: "transactions", label: "Transactions", icon: "❖", scope: "conference" },
      { id: "communications", label: "Communications", icon: "◐", scope: "conference" },
      { id: "awards", label: "Awards & Reviews", icon: "★", scope: "conference" },
      { id: "team", label: "Team", icon: "⚇", scope: "conference" },
      { id: "cameraCheckIn", label: "Camera Check-In", icon: "◍", scope: "conference" },
      { id: "settings", label: "Settings", icon: "⚙", scope: "conference" },
    ],
  },
];

const CONFERENCE_SCOPED_SECTIONS: ReadonlySet<OrganizerSectionId> = new Set<OrganizerSectionId>([
  "preview",
  "applications",
  "participants",
  "committees",
  "pricing",
  "transactions",
  "communications",
  "awards",
  "team",
  "cameraCheckIn",
  "settings",
]);

const ORGANIZER_SECTION_META: Record<OrganizerSectionId, { label: string; eyebrow: string; subtitle: string }> = {
  overview: {
    label: "Overview",
    eyebrow: "Workspace",
    subtitle: "Headline stats across every conference you organize.",
  },
  conferences: {
    label: "Conferences",
    eyebrow: "Workspace",
    subtitle: "Select a conference to manage its operations, or create a new one.",
  },
  preview: {
    label: "Preview & Content",
    eyebrow: "This conference",
    subtitle: "Edit the public conference page, policies, and marketing copy.",
  },
  applications: {
    label: "Applications",
    eyebrow: "This conference",
    subtitle: "Review, allot, and communicate with incoming delegate applications.",
  },
  participants: {
    label: "Participants",
    eyebrow: "This conference",
    subtitle: "Track allotments and monitor country-by-country assignments.",
  },
  committees: {
    label: "Committees",
    eyebrow: "This conference",
    subtitle: "Configure committees, chairs, members, and background guides.",
  },
  pricing: {
    label: "Categories & Pricing",
    eyebrow: "This conference",
    subtitle: "Registration categories, phases, and discount rules.",
  },
  transactions: {
    label: "Transactions",
    eyebrow: "This conference",
    subtitle: "Payments, refunds, and financial reporting for this conference.",
  },
  communications: {
    label: "Communications",
    eyebrow: "This conference",
    subtitle: "Broadcasts, status emails, and outbound messaging.",
  },
  awards: {
    label: "Awards & Reviews",
    eyebrow: "This conference",
    subtitle: "Manage awards, sponsors, and moderate conference reviews.",
  },
  team: {
    label: "Team",
    eyebrow: "This conference",
    subtitle: "Co-organizers and role-based permissions.",
  },
  cameraCheckIn: {
    label: "Camera Check-In",
    eyebrow: "This conference",
    subtitle: "Scan delegate passes and complete live check-ins.",
  },
  settings: {
    label: "Settings",
    eyebrow: "This conference",
    subtitle: "Partners, documents, past editions, and banking details.",
  },
};

const SECTION_SEARCH_KEYWORDS: Record<OrganizerSectionId, string[]> = {
  overview: ["workspace", "analytics", "stats"],
  conferences: ["active conference", "create conference"],
  preview: ["conference tags", "conference stats", "what's included", "schedule", "place", "dates", "venue"],
  applications: ["delegate application", "chair application", "organiser application", "delegation application"],
  participants: ["participant profile", "allotment", "country matrix"],
  committees: ["add committee", "edit details", "chairs", "agenda"],
  pricing: ["registration categories", "pricing phases", "question builder", "steps"],
  transactions: ["payments", "refunds", "invoices"],
  communications: ["announcements", "status email templates"],
  awards: ["reviews", "awards module"],
  team: ["organizer team", "members"],
  cameraCheckIn: ["qr scanner", "camera check in"],
  settings: ["documents", "partner conference", "previous editions", "banking details"],
};

const isOrganizerSectionId = (value: string): value is OrganizerSectionId =>
  Object.prototype.hasOwnProperty.call(ORGANIZER_SECTION_META, value);


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
    authReady,
    organizerConferences: rawOrganizerConferences,
    removeOrganizerConference,
    updateApplicantStatus,
    addAnnouncement,
    assignApplicant,
    unassignApplicant,
    updateOrganizerConferenceConfig,
    updateOrganizerCommitteeConfig,
    addOrganizerCommittee,
    removeOrganizerCommittee,
    updateRegistrationCategoryConfig,
    addConferenceAward,
    removeConferenceAward,
    updateOrganizerConferenceStatus,
  } = useAuth();

  const organizerConferences = useMemo(
    () =>
      rawOrganizerConferences.filter((conference) =>
        hasOrganizerConferenceAccess({ id: user?.id, email: user?.email }, conference)
      ),
    [rawOrganizerConferences, user?.id, user?.email]
  );

  const [selectedConferenceId, setSelectedConferenceId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<OrganizerSectionId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalSearchInput, setGlobalSearchInput] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [assignmentCommittee, setAssignmentCommittee] = useState<Record<string, string>>({});
  const [assignmentPortfolio, setAssignmentPortfolio] = useState<Record<string, string>>({});
  const [selectedApplicantId, setSelectedApplicantId] = useState<string>("");
  const [applicationTypeTab, setApplicationTypeTab] = useState<
    "delegate" | "chair" | "organizer" | "delegation"
  >("delegate");
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
    role: "USG",
  });
  const [questionEditorState, setQuestionEditorState] = useState<Record<string, { draft: string; isEditing: boolean }>>({});
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
    sponsorLogoSourceType: "url" as "url" | "upload",
    description: "",
    participantId: "",
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
    agendasText: "",
    logoImageUrl: "",
    chairs: [] as Array<{ id: string; name: string; email: string; role: string }>,
    customQuestions: [] as Array<{ id: string; question: string; required: boolean }>,
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
  const [previewScheduleDraft, setPreviewScheduleDraft] = useState<
    Array<{ id: string; day: string; fromTime: string; toTime: string; title: string }>
  >(normalizeScheduleEntries(organizerConferences[0]?.conferenceSchedule || []));
  const [previewSaveStatus, setPreviewSaveStatus] = useState("");
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<0 | 1>(0);
  const [partnerRelationships, setPartnerRelationships] = useState<PartnerRelationship[]>([]);
  const [partnerInviteTargetId, setPartnerInviteTargetId] = useState("");
  const [partnerActionStatus, setPartnerActionStatus] = useState("");
  const [commonDocumentDraft, setCommonDocumentDraft] = useState<DocumentDraft>({
    title: "",
    category: "background-guide",
    sourceType: "url",
    url: "",
  });
  const [committeeDocumentDraft, setCommitteeDocumentDraft] = useState<DocumentDraft>({
    title: "",
    category: "background-guide",
    sourceType: "url",
    url: "",
  });
  const [committeeDocumentTargetId, setCommitteeDocumentTargetId] = useState("");
  const [documentActionStatus, setDocumentActionStatus] = useState("");

  type GlobalSearchResult = {
    id: string;
    title: string;
    subtitle: string;
    type: "section" | "conference" | "applicant" | "participant";
    onSelect: () => void;
  };

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
      agendasText: [committee.agenda, ...(committee.customQuestions ?? []).map((q) => q.question)]
        .filter(Boolean)
        .join("\n"),
      logoImageUrl: committee.logoImageUrl || "",
      chairs:
        (committee.chairs ?? []).length > 0
          ? (committee.chairs ?? []).map((chair, index) => ({
              id: chair.id || `${committee.id}-chair-${index}`,
              name: chair.name || "",
              email: chair.email || "",
              role: chair.role || "",
            }))
          : committee.chairName
            ? [{ id: `${committee.id}-chair-legacy`, name: committee.chairName, email: committee.chairEmail || "", role: "Chair" }]
            : [],
      customQuestions: (committee.customQuestions ?? []).map((q) => ({ ...q })),
    });
    setDetailsEditorOpen(true);
  };

  const addChairDraftRow = () => {
    setDetailsEditorDraft((prev) => ({
      ...prev,
      chairs: [...prev.chairs, { id: `chair-${Date.now()}`, name: "", email: "", role: "" }],
    }));
  };

  const updateChairDraftRow = (chairId: string, patch: Partial<{ name: string; email: string; role: string }>) => {
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

  const readImageFileToDataUrl = (
    event: ChangeEvent<HTMLInputElement>,
    onDone: (dataUrl: string) => void,
    maxMb: number,
    label: string
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      alert(`Please choose an image file for ${label}.`);
      event.target.value = "";
      return;
    }
    const maxBytes = maxMb * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      alert(`${label} must be under ${maxMb}MB.`);
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      onDone(result);
      event.target.value = "";
    };
    reader.readAsDataURL(selectedFile);
  };

  const onPreviewLogoFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    readImageFileToDataUrl(
      event,
      (result) => setPreviewDraft((prev) => ({ ...prev, logoImageUrl: result })),
      2,
      "conference logo"
    );
  };

  const onPreviewBannerFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    readImageFileToDataUrl(
      event,
      (result) => setPreviewDraft((prev) => ({ ...prev, bannerImageUrl: result })),
      3,
      "conference banner"
    );
  };

  const onCommitteeLogoFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    readImageFileToDataUrl(
      event,
      (result) => setDetailsEditorDraft((prev) => ({ ...prev, logoImageUrl: result })),
      2,
      "committee logo"
    );
  };

  const onAwardLogoFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      alert("Please choose an image file for the award logo.");
      event.target.value = "";
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      alert("Award logo must be under 2MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setAwardDraft((prev) => ({
        ...prev,
        sponsorLogoSourceType: "upload",
        sponsorLogoUrl: dataUrl,
      }));
      event.target.value = "";
    };
    reader.readAsDataURL(selectedFile);
  };

  const saveCommitteeDetails = (conferenceId: string) => {
    if (!detailsEditorCommitteeId) return;
    const agendaLines = detailsEditorDraft.agendasText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const primaryAgenda = agendaLines[0] || detailsEditorDraft.agenda.trim() || "Agenda will be announced";
    const derivedTopics = agendaLines.slice(1).map((question, index) => ({
      id: `agenda-topic-${Date.now()}-${index}`,
      question,
      required: false,
    }));
    const normalizedChairs = detailsEditorDraft.chairs
      .map((chair, index) => ({
        id: chair.id || `${detailsEditorCommitteeId}-chair-${index}`,
        name: chair.name.trim(),
        email: chair.email.trim() || undefined,
        role: chair.role.trim() || undefined,
      }))
      .filter((chair) => chair.name);
    updateOrganizerCommitteeConfig(conferenceId, detailsEditorCommitteeId, {
      name: detailsEditorDraft.name.trim() || "Committee",
      description: detailsEditorDraft.description.trim() || undefined,
      agenda: primaryAgenda,
      logoImageUrl: detailsEditorDraft.logoImageUrl.trim() || undefined,
      chairs: normalizedChairs,
      chairName: normalizedChairs[0]?.name,
      chairEmail: normalizedChairs[0]?.email,
      customQuestions: derivedTopics,
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
      return;
    }
    if (user?.role === "delegate") {
      router.push("/dashboard");
    }
  }, [isLoggedIn, user, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && isOrganizerSectionId(hash)) {
      setActiveSection(hash);
    }
    const onHashChange = () => {
      const next = window.location.hash.replace(/^#/, "");
      if (next && isOrganizerSectionId(next)) {
        setActiveSection(next);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const changeActiveSection = (section: OrganizerSectionId) => {
    setActiveSection(section);
    setMobileNavOpen(false);
    if (typeof window !== "undefined") {
      const newUrl = `${window.location.pathname}${window.location.search}#${section}`;
      window.history.replaceState(null, "", newUrl);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    void ensureServerSession();
  }, [isLoggedIn, user]);

  const selectedConference = useMemo(() => {
    if (selectedConferenceId) {
      return organizerConferences.find((conference) => conference.id === selectedConferenceId);
    }
    return organizerConferences[0];
  }, [organizerConferences, selectedConferenceId]);
  const previewScheduleByDay = useMemo(
    () => groupScheduleByDay(previewScheduleDraft),
    [previewScheduleDraft]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGlobalSearchQuery(globalSearchInput);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [globalSearchInput]);

  const globalSearchResults = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    if (!q) return [] as GlobalSearchResult[];
    const results: GlobalSearchResult[] = [];
    const pushUnique = (entry: GlobalSearchResult) => {
      if (!results.some((existing) => existing.id === entry.id)) {
        results.push(entry);
      }
    };

    (Object.keys(ORGANIZER_SECTION_META) as OrganizerSectionId[]).forEach((sectionId) => {
      const meta = ORGANIZER_SECTION_META[sectionId];
      const keywordText = (SECTION_SEARCH_KEYWORDS[sectionId] || []).join(" ");
      const haystack = `${meta.label} ${meta.eyebrow} ${meta.subtitle} ${keywordText}`.toLowerCase();
      if (!haystack.includes(q)) return;
      pushUnique({
        id: `section-${sectionId}`,
        title: meta.label,
        subtitle: "Section",
        type: "section",
        onSelect: () => changeActiveSection(sectionId),
      });
    });

    organizerConferences.forEach((conference) => {
      const haystack = `${conference.title} ${conference.city} ${conference.country}`.toLowerCase();
      if (!haystack.includes(q)) return;
      pushUnique({
        id: `conference-${conference.id}`,
        title: conference.title,
        subtitle: `${conference.city}, ${conference.country}`,
        type: "conference",
        onSelect: () => {
          setSelectedConferenceId(conference.id);
          setPreviewDraft(buildPreviewDraft(conference));
          changeActiveSection("preview");
        },
      });
    });

    organizerConferences.forEach((conference) => {
      conference.applicants.forEach((applicant) => {
        const haystack = `${applicant.name} ${applicant.school} ${applicant.userEmail || ""}`.toLowerCase();
        if (!haystack.includes(q)) return;
        pushUnique({
          id: `applicant-${conference.id}-${applicant.id}`,
          title: applicant.name,
          subtitle: `Application · ${conference.title}`,
          type: "applicant",
          onSelect: () => {
            setSelectedConferenceId(conference.id);
            setPreviewDraft(buildPreviewDraft(conference));
            setSelectedApplicantId(applicant.id);
            setApplicantProfileDrawerOpen(true);
            changeActiveSection("applications");
          },
        });
      });
    });

    (selectedConference?.applicants || [])
      .filter((applicant) => applicant.status === "Allotted")
      .forEach((applicant) => {
      const haystack = `${applicant.name} ${applicant.school} ${applicant.countryPreference}`.toLowerCase();
      if (!haystack.includes(q)) return;
      pushUnique({
        id: `participant-${applicant.id}`,
        title: applicant.name,
        subtitle: "Participant",
        type: "participant",
        onSelect: () => {
          setParticipantSearchQuery(applicant.name);
          setSelectedApplicantId(applicant.id);
          setApplicantProfileDrawerOpen(true);
          changeActiveSection("participants");
        },
      });
    });

    return results.slice(0, 8);
  }, [globalSearchQuery, organizerConferences, selectedConference]);

  const savePreviewSettings = async () => {
    if (!selectedConference) return;
    try {
      updateOrganizerConferenceConfig(selectedConference.id, {
        title: previewDraft.title,
        city: previewDraft.city,
        country: previewDraft.country,
        organizerName: previewDraft.organizerName,
        venue: previewDraft.venue || undefined,
        startDate: previewDraft.startDate || selectedConference.startDate,
        endDate: previewDraft.endDate || selectedConference.endDate,
        description: previewDraft.description || undefined,
        termsAndConditions: previewDraft.termsAndConditions.trim() || undefined,
        refundPolicy: previewDraft.refundPolicy.trim() || undefined,
        codeOfConduct: previewDraft.codeOfConduct.trim() || undefined,
        faqNotes: previewDraft.faqNotes.trim() || undefined,
        logoImageUrl: previewDraft.logoImageUrl || undefined,
        bannerImageUrl: previewDraft.bannerImageUrl || undefined,
        socialLinks: {
          website: previewDraft.website || undefined,
          instagram: previewDraft.instagram || undefined,
          linkedin: previewDraft.linkedin || undefined,
          twitter: previewDraft.twitter || undefined,
        },
        tags: previewDraft.tags
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        capacity: Number(previewDraft.capacity) || selectedConference.capacity,
        level: previewDraft.level as OrganizerConference["level"],
        whatIsIncluded: previewDraft.whatIsIncluded
          .split("\n")
          .map((entry) => entry.trim())
          .filter(Boolean),
        conferenceSchedule: previewScheduleDraft,
      });
      const response = await fetch(`/api/organizers/conference-config/${selectedConference.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...previewDraft,
          conferenceSchedule: previewScheduleDraft,
          ownerUserId: selectedConference.ownerUserId || user?.id,
          ownerEmail: selectedConference.ownerEmail || user?.email,
          organizerTeamEmails: (selectedConference.organizerTeam || [])
            .map((member) => member.email.trim().toLowerCase())
            .filter(Boolean),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to save preview settings.");
      }
      setPreviewSaveStatus("Preview and policy changes saved.");
      window.setTimeout(() => setPreviewSaveStatus(""), 3500);
    } catch (error) {
      setPreviewSaveStatus(error instanceof Error ? error.message : "Unable to save preview settings. Please try again.");
    }
  };

  const previewHasUnsavedChanges = (() => {
    if (!selectedConference) return false;
    const base = buildPreviewDraft(selectedConference);
    const hasDraftDifferences = (Object.keys(base) as Array<keyof typeof base>).some(
      (key) => (previewDraft[key] ?? "") !== (base[key] ?? "")
    );
    if (hasDraftDifferences) return true;
    const baseSchedule = normalizeScheduleEntries(selectedConference.conferenceSchedule || []);
    return JSON.stringify(baseSchedule) !== JSON.stringify(previewScheduleDraft);
  })();
  const hasPaidRegistrations = Boolean(
    selectedConference?.applicants.some((applicant) => applicant.paid)
  );

  const deleteSelectedConference = async () => {
    if (!selectedConference || hasPaidRegistrations) return;
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1);
      return;
    }
    try {
      const response = await fetch(`/api/organizers/conferences/${selectedConference.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 404) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Unable to delete conference.");
      }
      removeOrganizerConference(selectedConference.id);
      setSelectedConferenceId("");
      setActiveSection("conferences");
      setPreviewSaveStatus("Conference deleted.");
    } catch (error) {
      setPreviewSaveStatus(error instanceof Error ? error.message : "Unable to delete conference.");
    } finally {
      setDeleteConfirmStep(0);
    }
  };

  useEffect(() => {
    if (!selectedConference) return;
    const hasSelected = selectedConference.committees.some((committee) => committee.id === committeeDocumentTargetId);
    if (!hasSelected) {
      setCommitteeDocumentTargetId(selectedConference.committees[0]?.id || "");
    }
  }, [selectedConference, committeeDocumentTargetId]);

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
          startDate: String(cfg.startDate ?? prev.startDate),
          endDate: String(cfg.endDate ?? prev.endDate),
          description: String(cfg.description ?? prev.description),
          termsAndConditions: String(cfg.termsAndConditions ?? prev.termsAndConditions),
          refundPolicy: String(cfg.refundPolicy ?? prev.refundPolicy),
          codeOfConduct: String(cfg.codeOfConduct ?? prev.codeOfConduct),
          faqNotes: String(cfg.faqNotes ?? prev.faqNotes),
          logoImageUrl: String(cfg.logoImageUrl ?? prev.logoImageUrl),
          bannerImageUrl: String(cfg.bannerImageUrl ?? prev.bannerImageUrl),
          website: String((cfg.socialLinks as { website?: string } | undefined)?.website ?? prev.website),
          instagram: String((cfg.socialLinks as { instagram?: string } | undefined)?.instagram ?? prev.instagram),
          linkedin: String((cfg.socialLinks as { linkedin?: string } | undefined)?.linkedin ?? prev.linkedin),
          twitter: String((cfg.socialLinks as { twitter?: string } | undefined)?.twitter ?? prev.twitter),
          tags: Array.isArray(cfg.tags) ? cfg.tags.map((entry) => String(entry)).join(", ") : prev.tags,
          capacity: Number(cfg.capacity ?? prev.capacity),
          whatIsIncluded: Array.isArray(cfg.whatIsIncluded)
            ? cfg.whatIsIncluded.map((entry) => String(entry)).join("\n")
            : prev.whatIsIncluded,
          level:
            cfg.level === "High School" || cfg.level === "University" || cfg.level === "Open"
              ? cfg.level
              : prev.level,
        }));
        if (Array.isArray(cfg.conferenceSchedule)) {
          setPreviewScheduleDraft(normalizeScheduleEntries(cfg.conferenceSchedule));
        }
      })
      .catch(() => null);
  }, [selectedConference]);

  useEffect(() => {
    setPreviewScheduleDraft(normalizeScheduleEntries(selectedConference?.conferenceSchedule || []));
  }, [selectedConference?.id, selectedConference?.conferenceSchedule]);

  useEffect(() => {
    setDeleteConfirmStep(0);
  }, [selectedConference?.id, activeSection]);

  useEffect(() => {
    if (!selectedConference) return;
    void fetch(`/api/organizers/overview/${selectedConference.id}`, { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setServerOverview(data.analytics || null))
      .catch(() => setServerOverview(null));
  }, [selectedConference]);

  useEffect(() => {
    if (!selectedConference) return;
    void fetch(`/api/organizers/partners/${selectedConference.id}`, { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        const rows = Array.isArray(data?.partnerships)
          ? (data.partnerships as PartnerRelationship[])
          : [];
        setPartnerRelationships(rows);
        const acceptedPartnerIds = rows
          .filter((entry) => entry.status === "ACCEPTED")
          .map((entry) => entry.partnerEvent.id);
        const currentPartnerIds = selectedConference.partnerConferenceIds || [];
        const nextSorted = [...acceptedPartnerIds].sort();
        const currentSorted = [...currentPartnerIds].sort();
        const partnerLinks = rows.map((entry) => ({
          id: entry.id,
          partnerConferenceId: entry.partnerEvent.id,
          partnerConferenceTitle: entry.partnerEvent.title,
          direction: entry.direction,
          status: entry.status,
          createdAt: undefined,
          updatedAt: undefined,
        }));
        if (JSON.stringify(nextSorted) !== JSON.stringify(currentSorted)) {
          updateOrganizerConferenceConfig(selectedConference.id, {
            partnerConferenceIds: nextSorted,
            partnerLinks,
          });
        }
      })
      .catch(() => setPartnerRelationships([]));
  }, [selectedConference, updateOrganizerConferenceConfig]);

  const refreshPartnerships = async () => {
    if (!selectedConference) return;
    const response = await fetch(`/api/organizers/partners/${selectedConference.id}`, {
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(data?.error || "Failed to refresh partners."));
    }
    const rows = Array.isArray(data?.partnerships) ? (data.partnerships as PartnerRelationship[]) : [];
    setPartnerRelationships(rows);
    const acceptedPartnerIds = rows
      .filter((entry) => entry.status === "ACCEPTED")
      .map((entry) => entry.partnerEvent.id);
    const partnerLinks = rows.map((entry) => ({
      id: entry.id,
      partnerConferenceId: entry.partnerEvent.id,
      partnerConferenceTitle: entry.partnerEvent.title,
      direction: entry.direction,
      status: entry.status,
      createdAt: undefined,
      updatedAt: undefined,
    }));
    updateOrganizerConferenceConfig(selectedConference.id, {
      partnerConferenceIds: acceptedPartnerIds,
      partnerLinks,
    });
  };

  const sendPartnerInvite = async () => {
    if (!selectedConference || !partnerInviteTargetId) return;
    setPartnerActionStatus("Sending invite...");
    try {
      const response = await fetch(`/api/organizers/partners/${selectedConference.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetEventId: partnerInviteTargetId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.error || "Failed to send invitation."));
      }
      setPartnerInviteTargetId("");
      await refreshPartnerships();
      setPartnerActionStatus("Invite sent.");
    } catch (error) {
      setPartnerActionStatus(error instanceof Error ? error.message : "Failed to send invitation.");
    }
  };

  const actOnPartnership = async (
    partnershipId: string,
    action: "accept" | "reject" | "cancel" | "unlink"
  ) => {
    if (!selectedConference) return;
    if (action === "reject" || action === "cancel" || action === "unlink") {
      const firstConfirm = window.confirm("This will remove the current partnership link. Continue?");
      if (!firstConfirm) return;
      const secondConfirm = window.confirm("Please confirm again to proceed with this removal action.");
      if (!secondConfirm) return;
    }
    setPartnerActionStatus("Updating partnership...");
    try {
      const response =
        action === "unlink"
          ? await fetch(`/api/organizers/partners/${selectedConference.id}/${partnershipId}`, {
              method: "DELETE",
              credentials: "include",
            })
          : await fetch(`/api/organizers/partners/${selectedConference.id}/${partnershipId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ action }),
            });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.error || "Failed to update partnership."));
      }
      await refreshPartnerships();
      setPartnerActionStatus("Partnership updated.");
    } catch (error) {
      setPartnerActionStatus(error instanceof Error ? error.message : "Failed to update partnership.");
    }
  };

  const resetDocumentDraft = (scope: "common" | "committee") => {
    const resetState: DocumentDraft = { title: "", category: "background-guide", sourceType: "upload", url: "" };
    if (scope === "common") {
      setCommonDocumentDraft(resetState);
      return;
    }
    setCommitteeDocumentDraft(resetState);
  };

  const readFileToDataUrl = (selectedFile: File, onDone: (payload: Partial<DocumentDraft>) => void) => {
    const allowed =
      selectedFile.type === "application/pdf" ||
      selectedFile.type.startsWith("image/") ||
      selectedFile.type.includes("document") ||
      selectedFile.type.includes("word");
    if (!allowed) {
      alert("Please upload a PDF, image, or doc file.");
      return;
    }
    const maxBytes = 8 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      alert("Document must be under 8MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      onDone({
        sourceType: "upload",
        url: result,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || undefined,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const createDocumentRecord = (draft: DocumentDraft): OrganizerDocument | null => {
    const title = draft.title.trim();
    const url = draft.url.trim();
    if (!title || !url) return null;
    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      category: draft.category,
      sourceType: draft.sourceType,
      url,
      fileName: draft.fileName,
      mimeType: draft.mimeType,
      uploadedAt: new Date().toISOString(),
    };
  };

  const addCommonDocument = () => {
    if (!selectedConference) return;
    const next = createDocumentRecord(commonDocumentDraft);
    if (!next) {
      setDocumentActionStatus("Please provide title and document link/file.");
      return;
    }
    updateOrganizerConferenceConfig(selectedConference.id, {
      commonDocuments: [...(selectedConference.commonDocuments || []), next],
    });
    resetDocumentDraft("common");
    setDocumentActionStatus("Common document added.");
  };

  const removeCommonDocument = (documentId: string) => {
    if (!selectedConference) return;
    const firstConfirm = window.confirm("Remove this document?");
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("Please confirm again: permanently remove this document?");
    if (!secondConfirm) return;
    updateOrganizerConferenceConfig(selectedConference.id, {
      commonDocuments: (selectedConference.commonDocuments || []).filter((entry) => entry.id !== documentId),
    });
    setDocumentActionStatus("Common document removed.");
  };

  const addCommitteeDocument = () => {
    if (!selectedConference || !committeeDocumentTargetId) return;
    const next = createDocumentRecord(committeeDocumentDraft);
    if (!next) {
      setDocumentActionStatus("Please provide title and document link/file.");
      return;
    }
    const committee = selectedConference.committees.find((entry) => entry.id === committeeDocumentTargetId);
    if (!committee) return;
    updateOrganizerCommitteeConfig(selectedConference.id, committeeDocumentTargetId, {
      documents: [...(committee.documents || []), next],
    });
    resetDocumentDraft("committee");
    setDocumentActionStatus("Committee document added.");
  };

  const removeCommitteeDocument = (committeeId: string, documentId: string) => {
    if (!selectedConference) return;
    const firstConfirm = window.confirm("Remove this committee document?");
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("Please confirm again: permanently remove this committee document?");
    if (!secondConfirm) return;
    const committee = selectedConference.committees.find((entry) => entry.id === committeeId);
    if (!committee) return;
    updateOrganizerCommitteeConfig(selectedConference.id, committeeId, {
      documents: (committee.documents || []).filter((entry) => entry.id !== documentId),
    });
    setDocumentActionStatus("Committee document removed.");
  };

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
  const filteredApplications = useMemo(() => {
    if (!selectedConference) return [];
    const categoryTypeById = new Map(
      selectedConference.registrationCategories.map((category) => [
        category.id,
        category.applicationType || "delegate",
      ])
    );
    return selectedConference.applicants.filter((applicant) => {
      const categoryType = applicant.categoryId
        ? categoryTypeById.get(applicant.categoryId) || "delegate"
        : "delegate";
      return categoryType === applicationTypeTab;
    });
  }, [selectedConference, applicationTypeTab]);

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

  const formatResponseLabel = (key: string) => {
    if (key.startsWith("cq-")) {
      // Key format: cq-COMMITTEEID-QUESTIONID
      // Strip prefix and committee ID for basic label
      return key.split("-").slice(2).join(" ").replace(/[_-]+/g, " ").trim().replace(/^\w/, (match) => match.toUpperCase()) || "Committee Question";
    }
    return key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\w/, (match) => match.toUpperCase());
  };
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
  const endCategoryPricingPhase = (
    conferenceId: string,
    category: OrganizerConference["registrationCategories"][number],
    phaseId: string
  ) => {
    const today = new Date().toISOString().slice(0, 10);
    updateCategoryPricingPhase(conferenceId, category, phaseId, { endDate: today });
  };
  const saveBankingDetails = () => {
    if (!selectedConference) return;
    const nextBankingDetails: OrganizerBankingDetails = {
      ...selectedConferenceBankingDetails,
      updatedAt: new Date().toISOString(),
    };
    updateOrganizerConferenceConfig(selectedConference.id, { bankingDetails: nextBankingDetails });
    setBankingSaveStatus("Banking details saved.");
    setTimeout(() => setBankingSaveStatus(""), 1800);
  };
  const selectedCountryEditorCommittee = useMemo(() => {
    if (!selectedConference || !countryEditorCommitteeId) return null;
    return selectedConference.committees.find((entry) => entry.id === countryEditorCommitteeId) || null;
  }, [selectedConference, countryEditorCommitteeId]);
  const selectedDetailsEditorCommittee = useMemo(() => {
    if (!selectedConference || !detailsEditorCommitteeId) return null;
    return selectedConference.committees.find((entry) => entry.id === detailsEditorCommitteeId) || null;
  }, [selectedConference, detailsEditorCommitteeId]);

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
    if (!confirm("Please confirm again: clear all banking details?")) return;
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
  if (!hydrated || !authReady || !isLoggedIn || !user) {
    return <AppRouteSkeleton />;
  }

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
      <div className="app-shell organizer-dashboard">
        <div className="max-w-7xl mx-auto">
          <header className="app-header">
            <div className="app-header-copy">
              <div className="section-label mb-3">Organizer Control Center</div>
              <h1 className="app-title">
                {user.name.split(" ")[0]}&apos;s Organizer Dashboard
              </h1>
              <p className="app-subtitle mt-2">
                Manage your conferences, delegate applications, and communications from one place.
              </p>
            </div>
            <div className="app-header-actions flex flex-col gap-3 items-stretch sm:items-end">
              {selectedConference && (
                <button
                  type="button"
                  className="btn btn-ghost text-sm w-full sm:w-[320px] justify-center"
                  onClick={() => changeActiveSection("cameraCheckIn")}
                >
                  Open Camera Check-In
                </button>
              )}
              <div className="relative w-full sm:w-[320px]">
                <input
                  value={globalSearchInput}
                  onChange={(event) => {
                    setGlobalSearchInput(event.target.value);
                    setGlobalSearchOpen(true);
                  }}
                  onFocus={() => setGlobalSearchOpen(true)}
                  className="input-base text-sm"
                  placeholder="Search sections, conferences, delegates..."
                />
                {globalSearchOpen && globalSearchQuery.trim() && (
                  <div
                    className="absolute z-40 mt-2 w-full rounded-xl overflow-hidden"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}
                  >
                    {globalSearchResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                        No matches found.
                      </p>
                    ) : (
                      globalSearchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="w-full text-left px-3 py-2 transition-colors"
                          style={{ borderBottom: "1px solid var(--border)" }}
                          onClick={() => {
                            result.onSelect();
                            setGlobalSearchOpen(false);
                            setGlobalSearchInput("");
                            setGlobalSearchQuery("");
                          }}
                        >
                          <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{result.title}</p>
                          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{result.subtitle}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Link href="/organizers/create" className="btn btn-primary text-sm w-full sm:w-[320px] justify-center">
                + Create New Conference
              </Link>
              <Link href="/organizers/payments" className="btn btn-ghost text-sm w-full sm:w-[320px] justify-center">
                Manual payments
              </Link>
              {canAccessSuperDashboard(user?.role, user?.email) && (
                <Link
                  href={SUPER_ADMIN_HREF}
                  className="btn btn-ghost text-sm w-full sm:w-[320px] justify-center border border-[var(--border)]"
                >
                  {SUPER_ADMIN_LABEL}
                </Link>
              )}
            </div>
          </header>

          <button
            type="button"
            className="app-sidebar-mobile-trigger mb-4"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open dashboard navigation"
          >
            <span aria-hidden>≡</span>
            <span>{ORGANIZER_SECTION_META[activeSection].label}</span>
          </button>

          <div className="app-layout">
            <aside className="app-sidebar hidden lg:flex">
              <div className="app-sidebar-picker">
                <span className="app-sidebar-picker-label">Active conference</span>
                <select
                  className="input-base text-sm"
                  value={selectedConferenceId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setSelectedConferenceId(nextId);
                    const nextConf = organizerConferences.find((c) => c.id === nextId) || null;
                    setPreviewDraft(buildPreviewDraft(nextConf));
                  }}
                >
                  <option value="">
                    {organizerConferences.length === 0 ? "No conferences yet" : "Select a conference"}
                  </option>
                  {organizerConferences.map((conference) => (
                    <option key={conference.id} value={conference.id}>
                      {conference.title}
                    </option>
                  ))}
                </select>
                {selectedConference && (
                  <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                    {selectedConference.city}, {selectedConference.country} · {selectedConference.status}
                  </p>
                )}
              </div>

              {ORGANIZER_NAV.map((group) => (
                <div key={group.label} className="app-sidebar-section">
                  <span className="app-sidebar-section-label">{group.label}</span>
                  {group.items.map((item) => {
                    const disabled = item.scope === "conference" && !selectedConference;
                    const count =
                      item.id === "applications" && selectedConference
                        ? selectedConference.applicants.filter((a) => a.status === "Pending").length
                        : undefined;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="app-sidebar-item"
                        data-active={activeSection === item.id ? "true" : "false"}
                        disabled={disabled}
                        onClick={() => changeActiveSection(item.id)}
                      >
                        <span className="app-sidebar-item-icon" aria-hidden>{item.icon}</span>
                        <span className="app-sidebar-item-label">{item.label}</span>
                        {count !== undefined && count > 0 && (
                          <span className="app-sidebar-item-count">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </aside>

            <main className="min-w-0">
              <nav className="app-breadcrumb" aria-label="Breadcrumb">
                <span>Organizer</span>
                <span className="app-breadcrumb-separator" aria-hidden>/</span>
                <span>{selectedConference ? selectedConference.title : "Workspace"}</span>
                <span className="app-breadcrumb-separator" aria-hidden>/</span>
                <span className="app-breadcrumb-current">{ORGANIZER_SECTION_META[activeSection].label}</span>
              </nav>

              {activeSection === "overview" && (
                <>
                  <header className="app-header" style={{ marginBottom: 24 }}>
                    <div className="app-header-copy">
                      <div className="section-label mb-2">{ORGANIZER_SECTION_META.overview.eyebrow}</div>
                      <h2 className="app-title">{ORGANIZER_SECTION_META.overview.label}</h2>
                      <p className="app-subtitle mt-2">{ORGANIZER_SECTION_META.overview.subtitle}</p>
                    </div>
                  </header>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: "Active Conferences", value: organizerConferences.length, icon: "🏛️", tone: "info" as const },
                      { label: "Total Applicants", value: totalApplicants, icon: "🧾", tone: "accent" as const },
                      { label: "Accepted Delegates", value: totalAccepted, icon: "✅", tone: "success" as const },
                      { label: "Collected Revenue", value: `$${totalRevenue}`, icon: "💰", tone: "warning" as const },
                    ].map((stat) => (
                      <div key={stat.label} className="app-stat">
                        <div className="app-stat-head">
                          <span className="app-stat-dot" data-tone={stat.tone} />
                          <span className="app-stat-label">{stat.label}</span>
                          <span className="ml-auto text-lg" aria-hidden>{stat.icon}</span>
                        </div>
                        <p className="app-stat-value">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {!selectedConference && (
                    <div className="app-card">
                      <div className="app-card-header">
                        <div>
                          <h3 className="app-card-title">No conference selected</h3>
                          <p className="app-card-subtitle">
                            Use the sidebar picker or open the Conferences section to choose one.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost text-sm"
                          onClick={() => changeActiveSection("conferences")}
                        >
                          Go to Conferences
                        </button>
                      </div>
                    </div>
                  )}

                  {!selectedConference && (
                    <div className="grid md:grid-cols-3 gap-3 mt-4">
                      <div className="skeleton" style={{ height: 90 }} />
                      <div className="skeleton" style={{ height: 90 }} />
                      <div className="skeleton" style={{ height: 90 }} />
                    </div>
                  )}

                  {selectedConference && !selectedConferenceAnalytics && (
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="skeleton" style={{ height: 120 }} />
                      <div className="skeleton" style={{ height: 120 }} />
                      <div className="skeleton" style={{ height: 120 }} />
                    </div>
                  )}
                </>
              )}

          {activeSection === "overview" && selectedConference && selectedConferenceAnalytics && (
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
                        <div className="progress-bar">
                          <div className="progress-bar-fill" style={{ width: `${entry.fillPercent}%` }} />
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

              {activeSection === "conferences" && (
                <>
                  <header className="app-header" style={{ marginBottom: 20 }}>
                    <div className="app-header-copy">
                      <div className="section-label mb-2">{ORGANIZER_SECTION_META.conferences.eyebrow}</div>
                      <h2 className="app-title">{ORGANIZER_SECTION_META.conferences.label}</h2>
                      <p className="app-subtitle mt-2">{ORGANIZER_SECTION_META.conferences.subtitle}</p>
                    </div>
                    <div className="app-header-actions">
                      <Link href="/organizers/create" className="btn btn-primary text-sm">
                        + Create New Conference
                      </Link>
                    </div>
                  </header>
                  {organizerConferences.length === 0 ? (
                    <div className="app-card">
                      <div className="app-card-header">
                        <div>
                          <h3 className="app-card-title">No conferences yet</h3>
                          <p className="app-card-subtitle">
                            Create your first conference to unlock all sections in the sidebar.
                          </p>
                        </div>
                        <Link href="/organizers/create" className="btn btn-primary text-sm">
                          + Create Conference
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {organizerConferences.map((conference) => (
                        <button
                          key={conference.id}
                          onClick={() => {
                            setSelectedConferenceId(conference.id);
                            setPreviewDraft(buildPreviewDraft(conference));
                            changeActiveSection("preview");
                          }}
                          className="app-card app-card-interactive rounded-2xl text-left"
                          data-selected={selectedConferenceId === conference.id ? "true" : "false"}
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
                  )}
                </>
              )}

              {CONFERENCE_SCOPED_SECTIONS.has(activeSection) && !selectedConference && (
                <div className="app-card">
                  <div className="app-card-header">
                    <div>
                      <h3 className="app-card-title">Select a conference</h3>
                      <p className="app-card-subtitle">
                        Choose a conference from the sidebar picker to open {ORGANIZER_SECTION_META[activeSection].label}.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost text-sm"
                      onClick={() => changeActiveSection("conferences")}
                    >
                      Browse conferences
                    </button>
                  </div>
                </div>
              )}

              {CONFERENCE_SCOPED_SECTIONS.has(activeSection) && selectedConference && (
                <>
                  <header className="app-header" style={{ marginBottom: 20 }}>
                    <div className="app-header-copy">
                      <div className="section-label mb-2">{ORGANIZER_SECTION_META[activeSection].eyebrow}</div>
                      <h2 className="app-title">{ORGANIZER_SECTION_META[activeSection].label}</h2>
                      <p className="app-subtitle mt-2">{ORGANIZER_SECTION_META[activeSection].subtitle}</p>
                    </div>
                  </header>

                  {activeSection === "preview" &&
                    selectedConference.status === "Draft" &&
                    selectedConference.adminRejectionNote?.trim() && (
                    <div
                      className="card p-4 rounded-2xl mb-4 border border-amber-500/35 bg-amber-500/10"
                      role="status"
                    >
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                        Not approved for publication
                      </p>
                      <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
                        {selectedConference.adminRejectionNote}
                      </p>
                      <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
                        Update your conference details, then use Publish Conference again when ready.
                      </p>
                    </div>
                  )}

                  {activeSection === "preview" && (
                  <div className="card p-6 rounded-2xl">
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                      <h2 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
                        {selectedConference.title}
                      </h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge ${STATUS_STYLES[selectedConference.status]}`}>
                          {selectedConference.status}
                        </span>
                        {selectedConference.status !== "Published" ? (
                          <button
                            type="button"
                            className="btn btn-primary text-xs"
                            onClick={() => updateOrganizerConferenceStatus(selectedConference.id, "Published")}
                          >
                            Publish Conference
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs"
                            onClick={() => updateOrganizerConferenceStatus(selectedConference.id, "Review")}
                          >
                            Move to Review
                          </button>
                        )}
                        <div className="badge badge-blue">Editing page content</div>
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
                  )}

                  {activeSection === "preview" && (
                  <div className="card p-6 rounded-2xl mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold" style={{ color: "var(--fg)" }}>Conference Page Preview</h3>
                      <button
                        className="btn btn-primary text-xs"
                        onClick={savePreviewSettings}
                      >
                        Save Preview Settings
                      </button>
                    </div>
                    <div
                      className="rounded-xl p-3 mb-4"
                      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                    >
                      <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Conference deletion</p>
                      {hasPaidRegistrations ? (
                        <p className="text-xs mt-1" style={{ color: "var(--danger-fg)" }}>
                          This conference cannot be deleted because paid registrations exist.
                        </p>
                      ) : (
                        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                          Deletion requires double confirmation.
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger-ghost text-xs mt-3"
                        disabled={hasPaidRegistrations}
                        onClick={() => void deleteSelectedConference()}
                      >
                        {deleteConfirmStep === 0 ? "Delete Conference" : "Confirm Delete Conference"}
                      </button>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <input value={previewDraft.title} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, title: event.target.value }))} className="input-base text-sm" placeholder="Conference title" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={previewDraft.city} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, city: event.target.value }))} className="input-base text-sm" placeholder="City" />
                          <input value={previewDraft.country} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, country: event.target.value }))} className="input-base text-sm" placeholder="Country" />
                        </div>
                        <input value={previewDraft.organizerName} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, organizerName: event.target.value }))} className="input-base text-sm" placeholder="Organizer name" />
                        <input value={previewDraft.venue} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, venue: event.target.value }))} className="input-base text-sm" placeholder="Venue" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={previewDraft.startDate} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, startDate: event.target.value }))} className="input-base text-sm" placeholder="Start date (YYYY-MM-DD)" />
                          <input value={previewDraft.endDate} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, endDate: event.target.value }))} className="input-base text-sm" placeholder="End date (YYYY-MM-DD)" />
                        </div>
                        <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Logo upload</label>
                        <input type="file" accept="image/*" className="input-base text-sm" onChange={onPreviewLogoFileSelected} />
                        <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Banner upload</label>
                        <input type="file" accept="image/*" className="input-base text-sm" onChange={onPreviewBannerFileSelected} />
                        <textarea value={previewDraft.description} onChange={(event) => setPreviewDraft((prev) => ({ ...prev, description: event.target.value }))} className="input-base text-sm" rows={3} placeholder="Conference description" />
                        <textarea
                          value={previewDraft.whatIsIncluded}
                          onChange={(event) => setPreviewDraft((prev) => ({ ...prev, whatIsIncluded: event.target.value }))}
                          className="input-base text-sm"
                          rows={5}
                          placeholder={"What's Included (one item per line)\nDelegate kit\nSocial events\nCertificate"}
                        />
                        <div className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--border)" }}>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Conference Schedule</p>
                            <button
                              type="button"
                              className="btn btn-ghost text-xs"
                              onClick={() =>
                                setPreviewScheduleDraft((prev) => {
                                  const nextDay = `Day ${new Set(prev.map((entry) => entry.day)).size + 1}`;
                                  return [
                                    ...prev,
                                    {
                                      id: `schedule-${Date.now()}`,
                                      day: nextDay,
                                      fromTime: "",
                                      toTime: "",
                                      title: "",
                                    },
                                  ];
                                })
                              }
                            >
                              + Add Day
                            </button>
                          </div>
                          {previewScheduleDraft.length === 0 && (
                            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                              No schedule events yet.
                            </p>
                          )}
                          <div className="space-y-2">
                            {previewScheduleByDay.map((dayGroup) => (
                              <div key={dayGroup.dayName} className="rounded-lg p-2 space-y-2" style={{ border: "1px solid var(--border)" }}>
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    className="input-base text-xs"
                                    value={dayGroup.dayName}
                                    onChange={(event) =>
                                      setPreviewScheduleDraft((prev) =>
                                        prev.map((item) =>
                                          item.day === dayGroup.dayName ? { ...item, day: event.target.value } : item
                                        )
                                      )
                                    }
                                    placeholder="Day name"
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-ghost text-xs"
                                      onClick={() =>
                                        setPreviewScheduleDraft((prev) => [
                                          ...prev,
                                          {
                                            id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                            day: dayGroup.dayName,
                                            fromTime: "",
                                            toTime: "",
                                            title: "",
                                          },
                                        ])
                                      }
                                    >
                                      + Add Event
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-danger-ghost text-xs"
                                      onClick={() =>
                                        setPreviewScheduleDraft((prev) =>
                                          prev.filter((item) => item.day !== dayGroup.dayName)
                                        )
                                      }
                                    >
                                      Remove Day
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {dayGroup.events.map((entry) => (
                                    <div key={entry.id} className="grid grid-cols-[110px_110px_1fr_70px] gap-2">
                                      <input
                                        className="input-base text-xs"
                                        value={entry.fromTime}
                                        onChange={(event) =>
                                          setPreviewScheduleDraft((prev) =>
                                            prev.map((item) =>
                                              item.id === entry.id ? { ...item, fromTime: event.target.value } : item
                                            )
                                          )
                                        }
                                        placeholder="From"
                                      />
                                      <input
                                        className="input-base text-xs"
                                        value={entry.toTime}
                                        onChange={(event) =>
                                          setPreviewScheduleDraft((prev) =>
                                            prev.map((item) =>
                                              item.id === entry.id ? { ...item, toTime: event.target.value } : item
                                            )
                                          )
                                        }
                                        placeholder="To"
                                      />
                                      <input
                                        className="input-base text-xs"
                                        value={entry.title}
                                        onChange={(event) =>
                                          setPreviewScheduleDraft((prev) =>
                                            prev.map((item) =>
                                              item.id === entry.id ? { ...item, title: event.target.value } : item
                                            )
                                          )
                                        }
                                        placeholder="Event title"
                                      />
                                      <button
                                        type="button"
                                        className="btn btn-danger-ghost text-xs"
                                        onClick={() =>
                                          setPreviewScheduleDraft((prev) => prev.filter((item) => item.id !== entry.id))
                                        }
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
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
                            backgroundImage: `linear-gradient(135deg, rgba(31,41,55,0.75), rgba(15,23,42,0.7)), url("${previewDraft.bannerImageUrl}")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          <div className="flex items-end gap-3">
                            {previewDraft.logoImageUrl && (
                              <Image
                                src={previewDraft.logoImageUrl}
                                alt="Conference logo"
                                width={46}
                                height={46}
                                className="w-11 h-11 rounded-lg object-cover"
                                style={{ border: "1px solid rgba(255,255,255,0.4)" }}
                                unoptimized
                              />
                            )}
                            <h4 className="text-white text-lg font-black">{previewDraft.title || "Conference Preview"}</h4>
                          </div>
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
                  )}

                  {activeSection === "preview" && (
                  <div className="card p-6 rounded-2xl mt-6">
                    <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Conference Policies & Info</h3>
                    <div className="space-y-3">
                      <textarea
                        value={previewDraft.termsAndConditions}
                        onChange={(event) =>
                          setPreviewDraft((prev) => ({ ...prev, termsAndConditions: event.target.value }))
                        }
                        className="input-base text-sm"
                        rows={4}
                        placeholder="Terms and conditions"
                      />
                      <textarea
                        value={previewDraft.refundPolicy}
                        onChange={(event) =>
                          setPreviewDraft((prev) => ({ ...prev, refundPolicy: event.target.value }))
                        }
                        className="input-base text-sm"
                        rows={3}
                        placeholder="Refund / cancellation policy"
                      />
                      <textarea
                        value={previewDraft.codeOfConduct}
                        onChange={(event) =>
                          setPreviewDraft((prev) => ({ ...prev, codeOfConduct: event.target.value }))
                        }
                        className="input-base text-sm"
                        rows={3}
                        placeholder="Code of conduct"
                      />
                      <textarea
                        value={previewDraft.faqNotes}
                        onChange={(event) =>
                          setPreviewDraft((prev) => ({ ...prev, faqNotes: event.target.value }))
                        }
                        className="input-base text-sm"
                        rows={4}
                        placeholder="FAQ / additional notes"
                      />
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        Saved using the same Preview Settings save button above.
                      </p>
                    </div>
                  </div>
                  )}

                  {activeSection === "preview" && (
                    <div className="card p-6 rounded-2xl mt-6">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Conference Stats & Tags</h3>
                      <div className="grid md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Capacity</label>
                          <input
                            className="input-base text-sm mt-1"
                            type="number"
                            value={previewDraft.capacity}
                            onChange={(event) => setPreviewDraft((prev) => ({ ...prev, capacity: Number(event.target.value) || 0 }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Level</label>
                          <select
                            className="input-base text-sm mt-1 app-select-modern"
                            value={previewDraft.level}
                            onChange={(event) =>
                              setPreviewDraft((prev) => ({
                                ...prev,
                                level: event.target.value as OrganizerConference["level"],
                              }))
                            }
                          >
                            <option value="High School">High School</option>
                            <option value="University">University</option>
                            <option value="Open">Open</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Conference Tags</label>
                          <input
                            className="input-base text-sm mt-1"
                            placeholder="e.g. Crisis, International, Beginner Friendly"
                            value={previewDraft.tags}
                            onChange={(event) => setPreviewDraft((prev) => ({ ...prev, tags: event.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button type="button" className="btn btn-primary text-xs" onClick={savePreviewSettings}>
                          Save stats and tags
                        </button>
                      </div>
                    </div>
                  )}

                  {activeSection === "preview" && previewSaveStatus && (
                    <div
                      className={`alert ${/unable|fail|error/i.test(previewSaveStatus) ? "alert-danger" : "alert-success"}`}
                      role="status"
                    >
                      <span>{previewSaveStatus}</span>
                    </div>
                  )}

                  {activeSection === "preview" && previewHasUnsavedChanges && (
                    <div className="app-sticky-bar">
                      <div>
                        <p className="app-sticky-bar-copy">You have unsaved preview edits.</p>
                        <p className="app-sticky-bar-copy-muted">Save to publish changes to your conference page.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost text-xs"
                          onClick={() => {
                            setPreviewDraft(buildPreviewDraft(selectedConference));
                            setPreviewScheduleDraft(normalizeScheduleEntries(selectedConference.conferenceSchedule || []));
                          }}
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary text-xs"
                          onClick={savePreviewSettings}
                        >
                          Save changes
                        </button>
                      </div>
                    </div>
                  )}

                  {activeSection === "applications" && (
                  <div className="card p-6 rounded-2xl">
                    <h3 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Applications</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {([
                        { id: "delegate", label: "Delegate Applications" },
                        { id: "chair", label: "Chair Applications" },
                        { id: "organizer", label: "Organiser Applications" },
                        { id: "delegation", label: "Delegation Applications" },
                      ] as const).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          className="btn btn-ghost text-xs"
                          data-active={applicationTypeTab === tab.id ? "true" : "false"}
                          onClick={() => setApplicationTypeTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid md:grid-cols-3 gap-2 mb-4">
                      {(["Pending", "Allotted", "Rejected"] as const).map((status) => {
                        const count = filteredApplications.filter((entry) => entry.status === status).length;
                        return (
                          <div key={status} className="rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
                            <p className="text-sm font-semibold" style={{ color: "var(--fg-muted)" }}>{status}</p>
                            <p className="text-2xl font-black" style={{ color: "var(--fg)" }}>{count}</p>
                          </div>
                        );
                      })}
                    </div>
                    {filteredApplications.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No applications yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {filteredApplications.map((applicant) => {
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
                                  <p className="font-semibold text-lg" style={{ color: "var(--fg)" }}>{applicant.name}</p>
                                  <p className="text-base" style={{ color: "var(--fg-muted)" }}>{applicant.school}</p>
                                  <p className="text-base mt-1" style={{ color: "var(--fg-muted)" }}>
                                    Category: {applicant.categoryName || "N/A"} · Country: {applicant.countryPreference || "N/A"}
                                  </p>
                                  {suggestedCommittee && (
                                    <p className="text-base mt-1" style={{ color: "var(--blue)" }}>
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

                              <div className={`grid gap-2 mt-3 ${applicationTypeTab === "chair" ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
                                <select
                                  className="input-base text-sm app-select-modern"
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
                                {applicationTypeTab !== "chair" && (
                                  <select
                                    className="input-base text-sm app-select-modern"
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
                                )}
                              </div>

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
                                    const result = assignApplicant({
                                      conferenceId: selectedConference.id,
                                      applicantId: applicant.id,
                                      committeeId: selectedCommitteeId,
                                      portfolioId:
                                        applicationTypeTab === "chair" ? undefined : selectedPortfolioId || undefined,
                                      allowOverride: false,
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
                  )}

                  {activeSection === "participants" && (
                  <>
                  <div className="card p-6 rounded-2xl">
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
                        className="input-base text-sm app-select-modern"
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
                        className="input-base text-sm app-select-modern"
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
                          className="grid md:grid-cols-[1.2fr_1fr_1fr_1fr_120px_120px] gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                          style={{ background: "var(--bg-subtle)", color: "var(--fg-muted)" }}
                        >
                          <span>Participant</span>
                          <span>Category</span>
                          <span>Committee</span>
                          <span>Country/Member</span>
                          <span>Status</span>
                          <span>Action</span>
                        </div>
                        {participantAllocationRows.map((applicant) => (
                          <div
                            key={applicant.id}
                            className="grid md:grid-cols-[1.2fr_1fr_1fr_1fr_120px_120px] gap-2 px-3 py-2 rounded-lg text-sm"
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
                            <button
                              type="button"
                              className="btn btn-ghost text-xs"
                              onClick={() => {
                                setSelectedApplicantId(applicant.id);
                                setApplicantProfileDrawerOpen(true);
                              }}
                            >
                              Details
                            </button>
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
                      <span className="badge badge-success">Green = Available</span>
                      <span className="badge badge-danger">Red = Allotted / Full</span>
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
                              {group.entries.map((entry) => {
                                const available = entry.seatState === "available";
                                return (
                                  <div
                                    key={entry.id}
                                    className="rounded-lg px-3 py-2 min-w-[180px]"
                                    style={{
                                      background: available ? "var(--success-subtle)" : "var(--danger-subtle)",
                                      border: `1px solid ${
                                        available
                                          ? "color-mix(in srgb, var(--success) 30%, transparent)"
                                          : "color-mix(in srgb, var(--danger) 30%, transparent)"
                                      }`,
                                    }}
                                  >
                                    <p
                                      className="text-xs font-semibold"
                                      style={{ color: available ? "var(--success-fg)" : "var(--danger-fg)" }}
                                    >
                                      {entry.name}
                                    </p>
                                    <p
                                      className="text-[11px]"
                                      style={{ color: available ? "var(--success-fg)" : "var(--danger-fg)", opacity: 0.85 }}
                                    >
                                      {entry.allottedCount}/{entry.seatCount} allotted · {entry.availableCount} available
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </>
                  )}

                  {activeSection === "committees" && (
                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Committees</h3>
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
                                    className="btn btn-danger-ghost text-xs"
                                    onClick={() => removeDraftMember(member.id)}
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
                          .map((committee, committeeIndex) => (
                          <div key={committee.id} className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                            {committee.logoImageUrl && (
                              <div className="mb-2 h-20 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${committee.logoImageUrl}")` }} />
                            )}
                            <p className="font-semibold text-lg" style={{ color: "var(--fg)" }}>{committeeIndex + 1}. {committee.name}</p>
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
                            {(committee.chairs || []).length > 0 && (
                              <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                                Chairs: {(committee.chairs || [])
                                  .map((chair) => `${chair.name}${chair.role ? ` (${chair.role})` : ""}`)
                                  .join(", ")}
                              </p>
                            )}
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
                            <button className="btn btn-ghost text-xs mt-2 mr-2" onClick={() => openDetailsEditor(committee)}>
                              Edit Details
                            </button>
                            <button
                              className="btn btn-ghost text-xs mt-2 mr-2"
                              onClick={() => openCountryEditor(committee)}
                            >
                              {committee.memberMode === "UN_COUNTRY" || committee.committeeType === "UN"
                                ? "Edit Countries"
                                : "Edit Members"}
                            </button>
                            <button
                              className="btn btn-ghost text-xs mt-2 mr-2"
                              onClick={() =>
                                updateOrganizerCommitteeConfig(selectedConference.id, committee.id, {
                                  isPublic: !(committee.isPublic !== false),
                                })
                              }
                            >
                              {committee.isPublic === false ? "Set Public" : "Set Private"}
                            </button>
                            <button
                              className="btn btn-danger-ghost text-xs mt-2 mr-2"
                              onClick={() => tryDeleteCommittee(selectedConference, committee)}
                            >
                              Delete Committee
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSection === "communications" && (
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
                  )}

                  {activeSection === "transactions" && (
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
                          <div className="flex flex-col gap-3 mb-3">
                            <input
                              className="input-base text-xs"
                              placeholder="Search name, category, committee..."
                              value={transactionSearchQuery}
                              onChange={(event) => setTransactionSearchQuery(event.target.value)}
                            />
                            <div className="flex flex-wrap gap-2">
                              <div className="segmented-control" role="group" aria-label="Payment state filter">
                                {(["all", "paid", "pending"] as const).map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    className="segmented-control-item"
                                    data-active={transactionPaymentFilter === value ? "true" : "false"}
                                    onClick={() => setTransactionPaymentFilter(value)}
                                  >
                                    {value === "all" ? "All payments" : value === "paid" ? "Paid" : "Pending"}
                                  </button>
                                ))}
                              </div>
                              <div className="segmented-control" role="group" aria-label="Refund filter">
                                {(["all", "active", "refunded"] as const).map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    className="segmented-control-item"
                                    data-active={transactionRefundFilter === value ? "true" : "false"}
                                    onClick={() => setTransactionRefundFilter(value)}
                                  >
                                    {value === "all" ? "All refunds" : value === "active" ? "Active" : "Refunded"}
                                  </button>
                                ))}
                              </div>
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
                  )}

                  {activeSection === "settings" && (
                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Conference Settings</h3>
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl space-y-3" style={{ background: "var(--bg-subtle)" }}>
                          <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Partner MUNs</p>
                          <div className="flex items-center gap-2">
                            <select
                              className="input-base text-xs flex-1"
                              value={partnerInviteTargetId}
                              onChange={(event) => setPartnerInviteTargetId(event.target.value)}
                            >
                              <option value="">Select organizer conference to invite</option>
                              {organizerConferences
                                .filter((entry) => entry.id !== selectedConference.id)
                                .map((entry) => (
                                  <option key={entry.id} value={entry.id}>
                                    {entry.title}
                                  </option>
                                ))}
                            </select>
                            <button
                              className="btn btn-primary text-xs"
                              disabled={!partnerInviteTargetId}
                              onClick={() => void sendPartnerInvite()}
                            >
                              Send Invite
                            </button>
                          </div>
                          {partnerActionStatus && (
                            <div
                              className={`alert ${/fail|error|unable|cannot|invalid/i.test(partnerActionStatus) ? "alert-danger" : "alert-success"}`}
                              role="status"
                            >
                              <span>{partnerActionStatus}</span>
                            </div>
                          )}
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                              Pending received
                            </p>
                            {partnerRelationships
                              .filter((entry) => entry.status === "PENDING" && entry.direction === "incoming")
                              .map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between gap-2">
                                  <p className="text-xs" style={{ color: "var(--fg)" }}>{entry.partnerEvent.title}</p>
                                  <div className="flex gap-1">
                                    <button className="btn btn-ghost text-xs" onClick={() => void actOnPartnership(entry.id, "accept")}>
                                      Accept
                                    </button>
                                    <button className="btn btn-ghost text-xs" onClick={() => void actOnPartnership(entry.id, "reject")}>
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                              Pending sent
                            </p>
                            {partnerRelationships
                              .filter((entry) => entry.status === "PENDING" && entry.direction === "outgoing")
                              .map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between gap-2">
                                  <p className="text-xs" style={{ color: "var(--fg)" }}>{entry.partnerEvent.title}</p>
                                  <button className="btn btn-ghost text-xs" onClick={() => void actOnPartnership(entry.id, "cancel")}>
                                    Cancel
                                  </button>
                                </div>
                              ))}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                              Accepted partners
                            </p>
                            {partnerRelationships
                              .filter((entry) => entry.status === "ACCEPTED")
                              .map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between gap-2">
                                  <p className="text-xs" style={{ color: "var(--fg)" }}>{entry.partnerEvent.title}</p>
                                  <button className="btn btn-ghost text-xs" onClick={() => void actOnPartnership(entry.id, "unlink")}>
                                    Unlink
                                  </button>
                                </div>
                              ))}
                            {partnerRelationships.filter((entry) => entry.status === "ACCEPTED").length === 0 && (
                              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No accepted partner MUNs yet.</p>
                            )}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                          <p className="text-xs font-semibold mb-2" style={{ color: "var(--fg)" }}>Common Documents</p>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <input
                              className="input-base text-xs col-span-2"
                              placeholder="Document title"
                              value={commonDocumentDraft.title ?? ""}
                              onChange={(event) =>
                                setCommonDocumentDraft((prev) => ({ ...prev, title: event.target.value }))
                              }
                            />
                            <select
                              className="input-base text-xs"
                              value={commonDocumentDraft.category ?? "background-guide"}
                              onChange={(event) =>
                                setCommonDocumentDraft((prev) => ({
                                  ...prev,
                                  category: event.target.value as OrganizerDocumentCategory,
                                }))
                              }
                            >
                              <option value="background-guide">Background Guide</option>
                              <option value="guidelines">Guidelines</option>
                              <option value="rules">Rules</option>
                              <option value="other">Other</option>
                            </select>
                            <input
                              className="input-base text-xs col-span-2"
                              type="file"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                              onChange={(event) => {
                                const selectedFile = event.target.files?.[0];
                                if (!selectedFile) return;
                                readFileToDataUrl(selectedFile, (payload) => {
                                  setCommonDocumentDraft((prev) => ({ ...prev, ...payload, sourceType: "upload" }));
                                });
                              }}
                            />
                          </div>
                          <button className="btn btn-primary text-xs" onClick={addCommonDocument}>Add Common Document</button>
                          <div className="mt-2 space-y-1">
                            {(selectedConference.commonDocuments || []).length === 0 && (
                              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No common documents yet.</p>
                            )}
                            {(selectedConference.commonDocuments || []).map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between gap-2">
                                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                  {doc.title} · {doc.category}
                                </p>
                                <button className="btn btn-ghost text-xs" onClick={() => removeCommonDocument(doc.id)}>
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                          <p className="text-xs font-semibold mb-2" style={{ color: "var(--fg)" }}>Committee Documents</p>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <select
                              className="input-base text-xs col-span-2"
                              value={committeeDocumentTargetId ?? ""}
                              onChange={(event) => setCommitteeDocumentTargetId(event.target.value)}
                            >
                              {selectedConference.committees.map((committee) => (
                                <option key={committee.id} value={committee.id}>
                                  {committee.name}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input-base text-xs col-span-2"
                              placeholder="Document title"
                              value={committeeDocumentDraft.title ?? ""}
                              onChange={(event) =>
                                setCommitteeDocumentDraft((prev) => ({ ...prev, title: event.target.value }))
                              }
                            />
                            <select
                              className="input-base text-xs"
                              value={committeeDocumentDraft.category ?? "background-guide"}
                              onChange={(event) =>
                                setCommitteeDocumentDraft((prev) => ({
                                  ...prev,
                                  category: event.target.value as OrganizerDocumentCategory,
                                }))
                              }
                            >
                              <option value="background-guide">Background Guide</option>
                              <option value="guidelines">Guidelines</option>
                              <option value="rules">Rules</option>
                              <option value="other">Other</option>
                            </select>
                            <input
                              className="input-base text-xs col-span-2"
                              type="file"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                              onChange={(event) => {
                                const selectedFile = event.target.files?.[0];
                                if (!selectedFile) return;
                                readFileToDataUrl(selectedFile, (payload) => {
                                  setCommitteeDocumentDraft((prev) => ({ ...prev, ...payload, sourceType: "upload" }));
                                });
                              }}
                            />
                          </div>
                          <button className="btn btn-primary text-xs" onClick={addCommitteeDocument}>
                            Add Committee Document
                          </button>
                          <div className="mt-2 space-y-1">
                            {selectedConference.committees
                              .filter((committee) => (committee.documents || []).length > 0)
                              .map((committee) => (
                                <div key={committee.id} className="space-y-1">
                                  <p className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>
                                    {committee.name}
                                  </p>
                                  {(committee.documents || []).map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between gap-2">
                                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                        {doc.title} · {doc.category}
                                      </p>
                                      <button
                                        className="btn btn-ghost text-xs"
                                        onClick={() => removeCommitteeDocument(committee.id, doc.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            {selectedConference.committees.every((committee) => (committee.documents || []).length === 0) && (
                              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No committee documents yet.</p>
                            )}
                          </div>
                        </div>
                        {documentActionStatus && (
                          <div
                            className={`alert ${/fail|error|unable|cannot|invalid/i.test(documentActionStatus) ? "alert-danger" : "alert-success"}`}
                            role="status"
                          >
                            <span>{documentActionStatus}</span>
                          </div>
                        )}
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
                              <div key={edition.id} className="flex items-center justify-between gap-2">
                                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                  {edition.year} · {edition.title} · {edition.delegates} delegates
                                </p>
                                <button
                                  className="btn btn-ghost text-xs"
                                  onClick={() => {
                                    const first = window.confirm(`Remove previous edition "${edition.title}"?`);
                                    if (!first) return;
                                    const second = window.confirm("Please confirm again to remove this edition.");
                                    if (!second) return;
                                    updateOrganizerConferenceConfig(selectedConference.id, {
                                      previousEditions: (selectedConference.previousEditions || []).filter((entry) => entry.id !== edition.id),
                                    });
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl space-y-2" style={{ background: "var(--bg-subtle)" }}>
                          <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                              Banking Details (Payout Account)
                            </p>
                            <button className="btn btn-danger-ghost text-xs" onClick={clearBankingDetails}>
                              Clear
                            </button>
                          </div>
                          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                            Account: {maskedAccountNumber} · Verification: {selectedConferenceBankingDetails.verificationStatus || "Unverified"}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                            Last updated: {selectedConferenceBankingDetails.updatedAt || "Not updated yet"}
                          </p>
                          {bankingSaveStatus && (
                            <div
                              className={`alert ${/fail|error|unable|cannot|invalid/i.test(bankingSaveStatus) ? "alert-danger" : "alert-success"}`}
                              role="status"
                            >
                              <span>{bankingSaveStatus}</span>
                            </div>
                          )}

                          <p className="text-sm font-semibold mt-2" style={{ color: "var(--fg)" }}>Account Info</p>
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

                          <p className="text-sm font-semibold mt-2" style={{ color: "var(--fg)" }}>Bank & Branch Info</p>
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

                          <p className="text-sm font-semibold mt-2" style={{ color: "var(--fg)" }}>International / Alternate</p>
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
                            <div className="alert alert-warning flex-col gap-1">
                              {bankingWarnings.map((warning) => (
                                <p key={warning} className="text-[11px]">
                                  {warning}
                                </p>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-end">
                            <button className="btn btn-primary text-xs" onClick={saveBankingDetails}>
                              Save Banking Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === "team" && (
                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Organizer Team</h3>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input className="input-base text-xs" placeholder="Name" value={teamDraft.name} onChange={(event) => setTeamDraft((prev) => ({ ...prev, name: event.target.value }))} />
                        <input className="input-base text-xs" placeholder="Email" value={teamDraft.email} onChange={(event) => setTeamDraft((prev) => ({ ...prev, email: event.target.value }))} />
                        <input
                          className="input-base text-xs col-span-2"
                          placeholder="Role (e.g. USG Finance)"
                          value={teamDraft.role}
                          onChange={(event) => setTeamDraft((prev) => ({ ...prev, role: event.target.value }))}
                        />
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
                              onClick={() => {
                                const firstConfirm = window.confirm(`Remove team member ${member.name}?`);
                                if (!firstConfirm) return;
                                const secondConfirm = window.confirm("Please confirm again to remove this team member.");
                                if (!secondConfirm) return;
                                updateOrganizerConferenceConfig(selectedConference.id, {
                                  organizerTeam: (selectedConference.organizerTeam || []).filter((entry) => entry.id !== member.id),
                                });
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSection === "awards" && (
                  <div className="grid md:grid-cols-1 gap-6">
                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Awards Module</h3>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input className="input-base text-xs" placeholder="Award category" value={awardDraft.category} onChange={(event) => setAwardDraft((prev) => ({ ...prev, category: event.target.value }))} />
                        <input className="input-base text-xs" placeholder="Prize title" value={awardDraft.prizeTitle} onChange={(event) => setAwardDraft((prev) => ({ ...prev, prizeTitle: event.target.value }))} />
                        <input className="input-base text-xs" placeholder="Sponsor name" value={awardDraft.sponsorName} onChange={(event) => setAwardDraft((prev) => ({ ...prev, sponsorName: event.target.value }))} />
                        <select
                          className="input-base text-xs"
                          value={awardDraft.sponsorLogoSourceType}
                          onChange={(event) =>
                            setAwardDraft((prev) => ({
                              ...prev,
                              sponsorLogoSourceType: event.target.value as "url" | "upload",
                              sponsorLogoUrl: "",
                            }))
                          }
                        >
                          <option value="url">Logo via URL</option>
                          <option value="upload">Upload logo</option>
                        </select>
                        {awardDraft.sponsorLogoSourceType === "url" ? (
                          <input
                            className="input-base text-xs"
                            placeholder="Sponsor logo URL"
                            value={awardDraft.sponsorLogoUrl}
                            onChange={(event) => setAwardDraft((prev) => ({ ...prev, sponsorLogoUrl: event.target.value }))}
                          />
                        ) : (
                          <input
                            className="input-base text-xs"
                            type="file"
                            accept="image/*"
                            onChange={onAwardLogoFileSelected}
                          />
                        )}
                        <select
                          className="input-base text-xs col-span-2"
                          value={awardDraft.participantId}
                          onChange={(event) => setAwardDraft((prev) => ({ ...prev, participantId: event.target.value }))}
                        >
                          <option value="">Select participant</option>
                          {selectedConference.applicants.map((applicant) => (
                            <option key={applicant.id} value={applicant.id}>
                              {applicant.name} {applicant.userId || applicant.userEmail ? "(linked)" : "(not linked)"}
                            </option>
                          ))}
                        </select>
                        <input className="input-base text-xs col-span-2" placeholder="Description" value={awardDraft.description} onChange={(event) => setAwardDraft((prev) => ({ ...prev, description: event.target.value }))} />
                      </div>
                      <button
                        className="btn btn-primary text-xs mb-3"
                        onClick={() => {
                          if (!awardDraft.category.trim() || !awardDraft.participantId) return;
                          const participant = selectedConference.applicants.find((entry) => entry.id === awardDraft.participantId);
                          addConferenceAward(selectedConference.id, {
                            category: awardDraft.category.trim(),
                            prizeTitle: awardDraft.prizeTitle.trim() || undefined,
                            sponsorName: awardDraft.sponsorName.trim() || undefined,
                            sponsorLogoUrl: awardDraft.sponsorLogoUrl.trim() || undefined,
                            description: awardDraft.description.trim() || undefined,
                            participantId: participant?.id,
                            participantName: participant?.name,
                            participantUserId: participant?.userId,
                            participantUserEmail: participant?.userEmail,
                          });
                          setAwardDraft({
                            category: "",
                            prizeTitle: "",
                            sponsorName: "",
                            sponsorLogoUrl: "",
                            sponsorLogoSourceType: "url",
                            description: "",
                            participantId: "",
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
                              <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                                Recipient: {award.participantName || "Not set"} · {award.participantUserId || award.participantUserEmail ? "Linked profile" : "Not linked"}
                              </p>
                            </div>
                            {award.sponsorLogoUrl && (
                              <Image
                                src={award.sponsorLogoUrl}
                                alt={`${award.category} logo`}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded object-cover"
                                style={{ border: "1px solid var(--border)" }}
                                unoptimized
                              />
                            )}
                            <button className="btn btn-ghost text-xs" onClick={() => removeConferenceAward(selectedConference.id, award.id)}>Remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}

                  {activeSection === "pricing" && (
                  <div className="card p-6 rounded-2xl">
                    <h3 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Registration Categories</h3>
                    <div className="space-y-4">
                      {selectedConference.registrationCategories.map((category) => {
                        const activePhase = getActivePhase(category.pricingPhases);
                        const categoryType = category.applicationType || "delegate";
                        const isChairCategory = categoryType === "chair";
                        const categoryLabel =
                          categoryType === "delegation"
                            ? "Delegation Registration"
                            : categoryType === "chair"
                              ? "Chair Registration"
                              : "Delegate Registration";
                        return (
                          <div key={category.id} className="p-4 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-lg" style={{ color: "var(--fg)" }}>{categoryLabel}</p>
                                <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{category.description || "No description yet."}</p>
                            <textarea
                              className="input-base text-xs mt-2"
                              rows={2}
                              placeholder="Edit category description"
                              value={category.description || ""}
                              onChange={(event) =>
                                updateRegistrationCategoryConfig(selectedConference.id, category.id, {
                                  description: event.target.value,
                                })
                              }
                            />
                              </div>
                              <span className="badge badge-blue">
                                {activePhase ? `${activePhase.name} Active` : "Base Price"}
                              </span>
                            </div>
                            <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
                              Default ${category.basePrice} · {category.requiresCommitteeSelection ? "Committee required" : "No committee selection"}
                            </p>
                            <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
                              {category.formFields.length} custom form fields · {category.pricingPhases.length} pricing phases
                            </p>
                            <p className="text-[11px] mt-1" style={{ color: "var(--fg-muted)" }}>
                              Pricing and questions in this card apply to this category&apos;s application form.
                            </p>
                            <div className="grid md:grid-cols-2 gap-2 mt-3">
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
                                {categoryLabel} Open
                              </label>
                            </div>
                            {category.applicationType === "delegation" && (
                              <div className="mt-2">
                                <label className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>
                                  Max delegates in one delegation
                                </label>
                                <input
                                  className="input-base text-xs mt-1"
                                  type="number"
                                  min={1}
                                  value={category.maxDelegatesPerDelegation ?? ""}
                                  onChange={(event) => {
                                    const parsed = Number(event.target.value);
                                    updateRegistrationCategoryConfig(selectedConference.id, category.id, {
                                      maxDelegatesPerDelegation:
                                        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined,
                                    });
                                  }}
                                  placeholder="e.g. 10"
                                />
                              </div>
                            )}
                            <div className="rounded-lg p-3 mt-3 space-y-2" style={{ background: "var(--bg)" }}>
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Category Pricing</p>
                                {!isChairCategory && (
                                  <button
                                    className="btn btn-ghost text-xs"
                                    onClick={() => addCategoryPricingPhase(selectedConference.id, category)}
                                  >
                                    + Add Phase
                                  </button>
                                )}
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
                              {isChairCategory ? (
                                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                                  Pricing phases are disabled for Chair Registration.
                                </p>
                              ) : category.pricingPhases.length === 0 ? (
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
                                          className="btn btn-ghost text-xs mr-2"
                                          onClick={() => endCategoryPricingPhase(selectedConference.id, category, phase.id)}
                                        >
                                          End Phase
                                        </button>
                                        <button
                                          className="btn btn-danger-ghost text-xs"
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
                              <div className="rounded-lg p-3" style={{ border: "1px solid var(--border)" }}>
                                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Student Flow Preview</p>
                                <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                                  Step 1: Basic Info (name, contact, category) → Step 2: {categoryLabel} Questions
                                </p>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Application Questions</p>
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
                                  {category.formFields.map((field, fieldIndex) => (
                                    <div key={field.id} className="rounded-lg p-2 space-y-2" style={{ border: "1px solid var(--border)" }}>
                                      <p className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Question {fieldIndex + 1}</p>
                                      <input
                                        className="input-base text-xs"
                                        placeholder="Question label"
                                        value={questionEditorState[field.id]?.isEditing ? questionEditorState[field.id]?.draft ?? field.label : field.label}
                                        readOnly={!questionEditorState[field.id]?.isEditing}
                                        onChange={(event) =>
                                          setQuestionEditorState((prev) => ({
                                            ...prev,
                                            [field.id]: { draft: event.target.value, isEditing: true },
                                          }))
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
                                        <div className="space-y-2">
                                          {(field.options || []).map((option, optionIndex) => (
                                            <input
                                              key={`${field.id}-option-${optionIndex}`}
                                              className="input-base text-xs"
                                              placeholder={`Option ${optionIndex + 1}`}
                                              value={option}
                                              onChange={(event) => {
                                                const next = [...(field.options || [])];
                                                next[optionIndex] = event.target.value;
                                                updateCategoryQuestion(selectedConference.id, category, field.id, {
                                                  options: next.filter((entry) => entry.trim()),
                                                });
                                              }}
                                            />
                                          ))}
                                          <button
                                            className="btn btn-ghost text-xs"
                                            onClick={() =>
                                              updateCategoryQuestion(selectedConference.id, category, field.id, {
                                                options: [...(field.options || []), `Option ${(field.options || []).length + 1}`],
                                              })
                                            }
                                          >
                                            + Add MCQ Option
                                          </button>
                                        </div>
                                      )}
                                      <div className="flex justify-end gap-2">
                                        <button
                                          className="btn btn-ghost text-xs"
                                          onClick={() => {
                                            if (questionEditorState[field.id]?.isEditing) {
                                              updateCategoryQuestion(selectedConference.id, category, field.id, {
                                                label: questionEditorState[field.id]?.draft ?? field.label,
                                              });
                                              setQuestionEditorState((prev) => ({
                                                ...prev,
                                                [field.id]: { draft: "", isEditing: false },
                                              }));
                                            } else {
                                              setQuestionEditorState((prev) => ({
                                                ...prev,
                                                [field.id]: { draft: field.label, isEditing: true },
                                              }));
                                            }
                                          }}
                                        >
                                          {questionEditorState[field.id]?.isEditing ? "Save Question" : "Edit Question"}
                                        </button>
                                        <button
                                          className="btn btn-danger-ghost text-xs"
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
                  )}

                  {activeSection === "communications" && (
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
                  )}

                  {activeSection === "cameraCheckIn" && (
                    <QrScannerPanel />
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </div>
      {mobileNavOpen && (
        <div
          className="app-drawer app-drawer-left"
          onClick={(event) => {
            if (event.target === event.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="app-drawer-panel p-5 flex flex-col gap-5" style={{ maxWidth: 380 }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: "var(--fg)" }}>Dashboard</h3>
              <button className="btn btn-ghost text-xs" onClick={() => setMobileNavOpen(false)}>
                Close
              </button>
            </div>
            <div className="app-sidebar-picker">
              <span className="app-sidebar-picker-label">Active conference</span>
              <select
                className="input-base text-sm"
                value={selectedConferenceId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedConferenceId(nextId);
                  const nextConf = organizerConferences.find((c) => c.id === nextId) || null;
                  setPreviewDraft(buildPreviewDraft(nextConf));
                }}
              >
                <option value="">
                  {organizerConferences.length === 0 ? "No conferences yet" : "Select a conference"}
                </option>
                {organizerConferences.map((conference) => (
                  <option key={conference.id} value={conference.id}>
                    {conference.title}
                  </option>
                ))}
              </select>
            </div>
            {ORGANIZER_NAV.map((group) => (
              <div key={`mobile-${group.label}`} className="app-sidebar-section">
                <span className="app-sidebar-section-label">{group.label}</span>
                {group.items.map((item) => {
                  const disabled = item.scope === "conference" && !selectedConference;
                  return (
                    <button
                      key={`mobile-${item.id}`}
                      type="button"
                      className="app-sidebar-item"
                      data-active={activeSection === item.id ? "true" : "false"}
                      disabled={disabled}
                      onClick={() => changeActiveSection(item.id)}
                    >
                      <span className="app-sidebar-item-icon" aria-hidden>{item.icon}</span>
                      <span className="app-sidebar-item-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>
        </div>
      )}
      {applicantProfileDrawerOpen && selectedApplicant && (
        <div className="app-drawer">
          <div className="app-drawer-panel app-drawer-panel-wide p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
                  Student Profile
                </h3>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
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
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Basic Profile</p>
              <div className="grid md:grid-cols-2 gap-3 text-sm" style={{ color: "var(--fg-muted)" }}>
                <p><strong style={{ color: "var(--fg)" }}>Name:</strong> {selectedApplicant.name || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Email:</strong> {selectedApplicant.userEmail || selectedApplicantUserProfile?.email || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>School:</strong> {selectedApplicant.school || selectedApplicantUserProfile?.school || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Country:</strong> {selectedApplicant.countryPreference || selectedApplicantUserProfile?.country || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Category:</strong> {selectedApplicant.categoryName || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Phone:</strong> {selectedApplicant.phone || selectedApplicantUserProfile?.phone || "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Status:</strong> {selectedApplicant.status}</p>
                <p><strong style={{ color: "var(--fg)" }}>Payment:</strong> {selectedApplicant.paid ? "Paid" : "Unpaid"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Amount:</strong> {typeof selectedApplicant.amount === "number" ? `$${selectedApplicant.amount}` : "N/A"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Assigned Committee:</strong> {selectedApplicant.assignedCommitteeName || "Not assigned"}</p>
                <p><strong style={{ color: "var(--fg)" }}>Assigned Portfolio:</strong> {selectedApplicant.assignedPortfolioName || "Not assigned"}</p>
              </div>
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>MUN Profile Summary</p>
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                <strong style={{ color: "var(--fg)" }}>Experience:</strong> {selectedApplicantUserProfile?.munExperienceSummary || "No MUN experience summary available."}
              </p>
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                <strong style={{ color: "var(--fg)" }}>Awards:</strong> {selectedApplicantUserProfile?.munAwardsSummary || "No MUN awards summary available."}
              </p>
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>MUN Participations</p>
              {selectedApplicantParticipationList.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No participation records available.</p>
              ) : (
                <div className="space-y-2">
                  {selectedApplicantParticipationList.map((participation) => (
                    <div key={participation.id} className="rounded-lg p-3 text-sm" style={{ background: "var(--bg)" }}>
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
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>MUN Awards</p>
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
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Submitted Answers</p>
              {selectedApplicantResponses.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No submitted responses found.</p>
              ) : (
                <div className="space-y-2">
                  {selectedApplicantResponses.map(([key, value]) => {
                    let label = formatResponseLabel(key);
                    if (key.startsWith("cq-") && selectedConference) {
                      const parts = key.split("-");
                      const committeeId = parts[1];
                      const questionId = parts[2];
                      
                      // Priority 1: Check the specifically prefixed committee first
                      let matchingQuestion = selectedConference.committees
                        .find(c => c.id === committeeId)
                        ?.customQuestions?.find(q => q.id === questionId);
                      
                      // Priority 2: Fallback to any committee (in case of transfer or duplicate IDs)
                      if (!matchingQuestion) {
                        for (const committee of selectedConference.committees) {
                          matchingQuestion = committee.customQuestions?.find(q => q.id === questionId);
                          if (matchingQuestion) break;
                        }
                      }

                      if (matchingQuestion) {
                        label = matchingQuestion.question;
                      }
                    }
                    return (
                      <div key={key} className="rounded-lg p-3 text-sm" style={{ background: "var(--bg)" }}>
                        <p className="font-semibold" style={{ color: "var(--fg)" }}>{label}</p>
                        {typeof value === "string" && value.startsWith("data:") ? (
                          value.startsWith("data:image/") ? (
                            <Image src={value} alt={label} width={180} height={120} className="rounded-md mt-2 h-auto w-auto max-h-40 object-cover" unoptimized />
                          ) : (
                            <a href={value} target="_blank" rel="noreferrer" className="text-sm mt-2 inline-block" style={{ color: "var(--blue)" }}>
                              Open uploaded file
                            </a>
                          )
                        ) : Array.isArray(value) ? (
                          <div className="mt-2 space-y-1">
                            {value.map((item, index) => (
                              <a key={`${key}-${index}`} href={String(item)} target="_blank" rel="noreferrer" className="text-sm block" style={{ color: "var(--blue)" }}>
                                Open file {index + 1}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: "var(--fg-muted)" }}>
                            {typeof value === "boolean" ? (value ? "Yes" : "No") : value === null || value === undefined || value === "" ? "N/A" : String(value)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {countryEditorOpen && selectedConference && selectedCountryEditorCommittee && (
        <div className="app-drawer">
          <div className="app-drawer-panel p-5">
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
                        className="btn btn-danger-ghost text-xs"
                        onClick={() => removeCountryFromEditor(country.id)}
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
        <div className="app-drawer">
          <div className="app-drawer-panel p-5">
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
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg-muted)" }}>Multiple Topics / Agendas (one per line)</p>
                <textarea
                  className="input-base text-sm"
                  rows={4}
                  placeholder={"Topic 1\nTopic 2\nTopic 3"}
                  value={detailsEditorDraft.agendasText}
                  onChange={(event) => setDetailsEditorDraft((prev) => ({ ...prev, agendasText: event.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-xl p-3 mb-4 space-y-2" style={{ background: "var(--bg-subtle)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Committee Logo</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onCommitteeLogoFileSelected}
                className="input-base text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[color:var(--blue)] file:px-3 file:py-1.5 file:text-white"
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
                  <div key={chair.id} className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2">
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
                    <input
                      className="input-base text-xs"
                      placeholder="Role (Vice Chair, Rapporteur...)"
                      value={chair.role}
                      onChange={(event) => updateChairDraftRow(chair.id, { role: event.target.value })}
                    />
                    <button
                      className="btn btn-danger-ghost text-xs"
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
