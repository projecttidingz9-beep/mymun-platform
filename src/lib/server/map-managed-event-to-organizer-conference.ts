import type {
  OrganizerAnnouncement,
  OrganizerApplicant,
  OrganizerAwardConfig,
  OrganizerCommittee,
  OrganizerConference,
  OrganizerConferencePartnerLink,
  OrganizerDocumentCategory,
  ConferenceReview,
  RegistrationCategory,
} from "@/lib/types";
import type { CommitteeVisibility as CommitteeVisibilityType } from "@/generated/prisma/client";
import type { EventStatus } from "@/generated/prisma/enums";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { moneyNumber } from "@/lib/server/decimal-money";
import { prisma } from "./prisma";
import { getOrganizerStoredBlob } from "./organizer-config-store";

function mapEventStatus(status: EventStatus): OrganizerConference["status"] {
  if (status === "DRAFT") return "Draft";
  if (status === "REVIEW") return "Review";
  if (status === "PUBLISHED") return "Published";
  if (status === "CANCELLED" || status === "ARCHIVED") return "Draft";
  return "Draft";
}

function mapRegistrationStatus(s: RegistrationStatus): OrganizerApplicant["status"] {
  switch (s) {
    case "ALLOTTED":
      return "Allotted";
    case "WAITLISTED":
      return "Waitlisted";
    case "REJECTED":
      return "Rejected";
    default:
      return "Pending";
  }
}

function parseJsonValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function recomputeCommitteeAllotments(conference: OrganizerConference): OrganizerConference {
  const portfolioAssignments = new Map<string, string[]>();

  for (const applicant of conference.applicants) {
    if (applicant.status !== "Allotted" || !applicant.assignedCommitteeId) continue;
    if (applicant.assignedPortfolioId) {
      portfolioAssignments.set(applicant.assignedPortfolioId, [
        ...(portfolioAssignments.get(applicant.assignedPortfolioId) ?? []),
        applicant.id,
      ]);
    }
  }

  return {
    ...conference,
    committees: conference.committees.map((committee) => ({
      ...committee,
      allottedCount: conference.applicants.filter(
        (applicant) =>
          applicant.status === "Allotted" && applicant.assignedCommitteeId === committee.id
      ).length,
      portfolios: (committee.portfolios ?? []).map((portfolio) => ({
        ...portfolio,
        assignedApplicantIds: portfolioAssignments.get(portfolio.id) ?? [],
      })),
    })),
  };
}

function committeeFromDbRow(
  c: {
    id: string;
    name: string;
    agenda: string;
    type: string | null;
    committeeFormat?: string | null;
    metadataJson?: string | null;
    positionPaperDeadline?: Date | null;
    chairName: string | null;
    chairEmail: string | null;
    seatCount: number;
    basePrice: unknown;
    visibility: CommitteeVisibilityType;
    questions: Array<{ id: string; label: string; type: string; required: boolean; optionsJson: string | null }>;
    portfolios?: Array<{ id: string; name: string; seatCount: number }>;
    documents?: Array<{
      id: string;
      title: string;
      category: string;
      fileUrl: string;
      version: string | null;
      publishedAt: Date;
    }>;
  }
): OrganizerCommittee {
  const rawType = (c.type || "").trim();
  let committeeType: OrganizerCommittee["committeeType"] = "CUSTOM";
  let customTypeLabel: string | undefined;
  let legacyType = rawType;
  if (rawType.toUpperCase() === "UN" || rawType === "UN") {
    committeeType = "UN";
    legacyType = "UN";
  } else if (rawType.toUpperCase().includes("NON")) {
    committeeType = "NON_UN";
    legacyType = "Non-UN";
  } else if (rawType) {
    committeeType = "CUSTOM";
    customTypeLabel = rawType;
    legacyType = rawType;
  } else {
    committeeType = "UN";
    legacyType = "UN";
  }

  let metadata: OrganizerCommittee["metadata"];
  if (c.metadataJson) {
    try {
      metadata = JSON.parse(c.metadataJson) as OrganizerCommittee["metadata"];
    } catch {
      metadata = undefined;
    }
  }

  return {
    id: c.id,
    name: c.name,
    agenda: c.agenda || "Agenda",
    description: undefined,
    seatCount: c.seatCount,
    basePrice: c.basePrice == null ? undefined : moneyNumber(c.basePrice),
    chairName: c.chairName ?? undefined,
    chairEmail: c.chairEmail ?? undefined,
    isPublic: c.visibility === "PUBLIC",
    committeeType,
    committeeFormat: c.committeeFormat ?? undefined,
    customTypeLabel,
    type: legacyType,
    memberMode: committeeType === "UN" ? "UN_COUNTRY" : "CUSTOM_MEMBER",
    metadata,
    positionPaperDeadline: c.positionPaperDeadline?.toISOString(),
    customQuestions: c.questions.map((q) => ({
      id: q.id,
      question: q.label,
      required: q.required,
    })),
    portfolios: (c.portfolios ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      seatCount: p.seatCount,
      assignedApplicantIds: [],
    })),
    chairs: [],
    documents: (c.documents ?? []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category as OrganizerDocumentCategory,
      sourceType: "url" as const,
      url: doc.fileUrl,
      uploadedAt: doc.publishedAt.toISOString(),
    })),
  };
}

function mergeCommittees(dbList: OrganizerCommittee[], blobList: OrganizerCommittee[]): OrganizerCommittee[] {
  const blobById = new Map(blobList.map((c) => [c.id, c]));
  const merged = dbList.map((db) => {
    const blob = blobById.get(db.id);
    if (!blob) return db;
    blobById.delete(db.id);
    return {
      ...db,
      ...blob,
      id: db.id,
      seatCount: blob.seatCount ?? db.seatCount,
      name: blob.name ?? db.name,
      agenda: blob.agenda ?? db.agenda,
      portfolios: blob.portfolios ?? db.portfolios ?? [],
      chairs: blob.chairs ?? db.chairs ?? [],
      customQuestions:
        blob.customQuestions && blob.customQuestions.length > 0
          ? blob.customQuestions
          : db.customQuestions,
      documents: blob.documents ?? db.documents,
    };
  });
  for (const leftover of blobById.values()) {
    merged.push(leftover);
  }
  return merged;
}

export async function mapManagedEventToOrganizerConference(eventId: string): Promise<OrganizerConference | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    include: {
      organizerConfig: {
        include: {
          committees: { include: { questions: true, portfolios: true, documents: true } },
          registrationCategories: true,
          pricingPhases: true,
        },
      },
      registrations: {
        where: { deletedAt: null },
        include: {
          user: { select: { name: true, email: true } },
          paymentIntent: { select: { status: true } },
          applicationAnswers: { include: { question: true } },
        },
      },
      outgoingPartnerships: {
        include: { targetEvent: { select: { id: true, title: true } } },
      },
      incomingPartnerships: {
        include: { sourceEvent: { select: { id: true, title: true } } },
      },
      awards: true,
      reviews: { include: { user: { select: { name: true } } } },
      teamMembers: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  if (!event) return null;

  const blob = await getOrganizerStoredBlob(eventId);
  const blobCommittees = Array.isArray(blob.committees)
    ? (blob.committees as OrganizerCommittee[])
    : [];
  const blobCategories = Array.isArray(blob.registrationCategories)
    ? (blob.registrationCategories as RegistrationCategory[])
    : undefined;
  const blobAnnouncements = Array.isArray(blob.announcements)
    ? (blob.announcements as OrganizerAnnouncement[])
    : [];
  const applicantExtras =
    blob.applicantExtras && typeof blob.applicantExtras === "object"
      ? (blob.applicantExtras as Record<string, Partial<OrganizerApplicant>>)
      : {};

  const dbCommittees =
    event.organizerConfig?.committees.map((c) =>
      committeeFromDbRow({
        id: c.id,
        name: c.name,
        agenda: c.agenda,
        type: c.type,
        committeeFormat: c.committeeFormat,
        metadataJson: c.metadataJson,
        positionPaperDeadline: c.positionPaperDeadline,
        chairName: c.chairName,
        chairEmail: c.chairEmail,
        seatCount: c.seatCount,
        basePrice: c.basePrice,
        visibility: c.visibility,
        questions: c.questions,
        portfolios: c.portfolios,
        documents: c.documents,
      })
    ) ?? [];
  const committees = mergeCommittees(dbCommittees, blobCommittees);

  function committeePricesFromJson(json: string | null, cmts: OrganizerCommittee[]) {
    if (!json) {
      return cmts.map((cm) => ({
        committeeId: cm.id,
        committeeName: cm.name,
        price: cm.basePrice ?? 0,
      }));
    }
    try {
      const map = JSON.parse(json) as Record<string, number>;
      return cmts.map((cm) => ({
        committeeId: cm.id,
        committeeName: cm.name,
        price: typeof map[cm.id] === "number" ? map[cm.id] : cm.basePrice ?? 0,
      }));
    } catch {
      return cmts.map((cm) => ({
        committeeId: cm.id,
        committeeName: cm.name,
        price: cm.basePrice ?? 0,
      }));
    }
  }

  const pricingPhases =
    event.organizerConfig?.pricingPhases.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
      basePrice: moneyNumber(p.basePrice),
      committeePrices: committeePricesFromJson(p.committeePriceJson, committees),
    })) ?? [];

  let registrationCategories: RegistrationCategory[];
  if (blobCategories && blobCategories.length > 0) {
    registrationCategories = blobCategories;
  } else {
    registrationCategories = [
      {
        id: "cat-default",
        name: "Delegate Registration",
        description: "Default registration category.",
        applicationType: "delegate",
        isOpen: true,
        basePrice: pricingPhases[0]?.basePrice ?? 0,
        requiresCommitteeSelection: true,
        formFields: [],
        pricingPhases,
      },
    ];
  }

  const committeeNameToId = new Map(committees.map((c) => [c.name.toLowerCase(), c.id]));

  const applicants: OrganizerApplicant[] = event.registrations.map((reg) => {
    const responses: Record<string, string | number | boolean | string[]> = {};
    for (const a of reg.applicationAnswers) {
      const key = a.question.label;
      const v = parseJsonValue(a.valueJson);
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        responses[key] = v;
      } else if (Array.isArray(v)) {
        responses[key] = v.map(String);
      } else if (v !== undefined && v !== null) {
        responses[key] = String(v);
      }
    }

    const isAllotted = reg.status === RegistrationStatus.ALLOTTED;
    const assignedCommitteeId =
      isAllotted &&
      reg.committeeName &&
      committeeNameToId.has(reg.committeeName.toLowerCase())
        ? committeeNameToId.get(reg.committeeName.toLowerCase())
        : undefined;

    if (reg.formAnswersJson) {
      try {
        const parsed = JSON.parse(reg.formAnswersJson) as Record<string, unknown>;
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            responses[key] = value;
          } else if (Array.isArray(value)) {
            responses[key] = value.map(String);
          }
        }
      } catch {
        // ignore
      }
    }

    let committeePreferences: string[] = [];
    if (reg.committeePreferencesJson) {
      try {
        committeePreferences = JSON.parse(reg.committeePreferencesJson) as string[];
      } catch {
        committeePreferences = [];
      }
    } else if (!isAllotted && reg.committeeName) {
      committeePreferences = [reg.committeeName];
    }

    let portfolioPreferencesByCommittee: Record<string, string[]> | undefined;
    if (reg.portfolioPreferencesJson) {
      try {
        portfolioPreferencesByCommittee = JSON.parse(reg.portfolioPreferencesJson) as Record<
          string,
          string[]
        >;
      } catch {
        portfolioPreferencesByCommittee = undefined;
      }
    }

    let countryPreferences: string[] | undefined;
    if (reg.countryPreferencesJson) {
      try {
        countryPreferences = JSON.parse(reg.countryPreferencesJson) as string[];
      } catch {
        countryPreferences = undefined;
      }
    }

    const base: OrganizerApplicant = {
      id: reg.id,
      name: reg.user.name,
      school: String(responses.school ?? responses.School ?? ""),
      countryPreference:
        countryPreferences?.[0] ?? String(responses.country ?? responses.Country ?? ""),
      countryPreferences,
      committeePreference: isAllotted ? "" : committeePreferences[0] ?? "",
      committeePreferences: isAllotted ? [] : committeePreferences,
      portfolioPreferencesByCommittee: isAllotted ? undefined : portfolioPreferencesByCommittee,
      categoryName: reg.categoryName,
      categoryId: reg.categoryId ?? undefined,
      assignmentStatus: mapRegistrationStatus(reg.status),
      assignedCommitteeId,
      assignedCommitteeName: isAllotted ? reg.committeeName ?? undefined : undefined,
      assignedPortfolioId: isAllotted ? reg.portfolioId ?? undefined : undefined,
      assignedPortfolioName: isAllotted ? reg.portfolioName ?? undefined : undefined,
      assignedAt: reg.allottedAt?.toISOString(),
      paid: reg.paid,
      paymentIntentStatus: reg.paymentIntent?.status,
      amount: moneyNumber(reg.amount),
      responses,
      registrationId: reg.id,
      registeredAt: reg.createdAt.toISOString(),
      userId: reg.userId,
      userEmail: reg.user.email,
      status: mapRegistrationStatus(reg.status),
    };

    const extra = applicantExtras[reg.id];
    if (!extra) return base;

    return {
      ...base,
      ...extra,
      status: (extra.status as OrganizerApplicant["status"]) ?? base.status,
      assignmentHistory: extra.assignmentHistory ?? base.assignmentHistory,
    };
  });

  const partnerLinks: OrganizerConferencePartnerLink[] = [
    ...event.outgoingPartnerships.map((p) => ({
      id: p.id,
      partnerConferenceId: p.targetEventId,
      partnerConferenceTitle: p.targetEvent.title,
      direction: "outgoing" as const,
      status: p.status as OrganizerConferencePartnerLink["status"],
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    ...event.incomingPartnerships.map((p) => ({
      id: p.id,
      partnerConferenceId: p.sourceEventId,
      partnerConferenceTitle: p.sourceEvent.title,
      direction: "incoming" as const,
      status: p.status as OrganizerConferencePartnerLink["status"],
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  ];

  const awards: OrganizerAwardConfig[] = event.awards.map((a) => ({
    id: a.id,
    category: a.category,
    presetKey: a.presetKey ?? undefined,
    prizeTitle: a.prizeTitle ?? undefined,
    sponsorLogoUrl: a.sponsorLogoUrl ?? undefined,
    sponsorName: a.sponsorName ?? undefined,
    description: a.description ?? undefined,
    participantId: a.recipientRegistrationId ?? undefined,
    participantName: a.participantName ?? undefined,
    participantUserId: a.recipientUserId ?? undefined,
    recipientDelegationId: a.recipientDelegationId ?? undefined,
  }));

  const reviews: ConferenceReview[] = event.reviews.map((r) => ({
    id: r.id,
    conferenceId: eventId,
    userId: r.userId,
    userName: r.user.name,
    rating: r.rating,
    comment: r.comment ?? "",
    status: (r.status === "hidden" ? "hidden" : r.status === "approved" ? "approved" : "pending") as ConferenceReview["status"],
    featured: r.featured,
    createdAt: r.createdAt.toISOString(),
  }));

  const previewTitle = typeof blob.title === "string" ? blob.title : "";
  const title = previewTitle.trim() ? previewTitle : event.title;

  const conference: OrganizerConference = {
    id: event.id,
    ownerUserId: typeof blob.ownerUserId === "string" ? blob.ownerUserId : event.ownerUserId ?? undefined,
    ownerEmail: typeof blob.ownerEmail === "string" ? blob.ownerEmail : undefined,
    currency: event.currency?.trim() || "INR",
    title,
    city: typeof blob.city === "string" ? blob.city : "",
    country: typeof blob.country === "string" ? blob.country : "",
    organizerName: typeof blob.organizerName === "string" ? blob.organizerName : "",
    contactDetail: typeof blob.contactDetail === "string" ? blob.contactDetail : undefined,
    tags: Array.isArray(blob.tags) ? (blob.tags as string[]) : undefined,
    venue: typeof blob.venue === "string" ? blob.venue : event.organizerConfig?.venue ?? undefined,
    level:
      blob.level === "High School" || blob.level === "University" || blob.level === "Open"
        ? blob.level
        : "High School",
    capacity: typeof blob.capacity === "number" ? blob.capacity : 100,
    startDate:
      typeof blob.startDate === "string" && blob.startDate
        ? blob.startDate
        : event.startDate.toISOString().slice(0, 10),
    endDate:
      typeof blob.endDate === "string" && blob.endDate
        ? blob.endDate
        : event.endDate.toISOString().slice(0, 10),
    whatIsIncluded: Array.isArray(blob.whatIsIncluded) ? (blob.whatIsIncluded as string[]) : undefined,
    conferenceSchedule: Array.isArray(blob.conferenceSchedule)
      ? (blob.conferenceSchedule as OrganizerConference["conferenceSchedule"])
      : undefined,
    registrationDeadline:
      typeof blob.registrationDeadline === "string" ? blob.registrationDeadline : undefined,
    logoImageUrl: typeof blob.logoImageUrl === "string" ? blob.logoImageUrl : event.organizerConfig?.logoImageUrl ?? undefined,
    bannerImageUrl:
      typeof blob.bannerImageUrl === "string"
        ? blob.bannerImageUrl
        : event.coverImageUrl || event.organizerConfig?.bannerImageUrl || undefined,
    bannerSourceType: blob.bannerSourceType === "upload" || blob.bannerSourceType === "url" ? blob.bannerSourceType : undefined,
    description: typeof blob.description === "string" ? blob.description : undefined,
    termsAndConditions: typeof blob.termsAndConditions === "string" ? blob.termsAndConditions : undefined,
    refundPolicy: typeof blob.refundPolicy === "string" ? blob.refundPolicy : undefined,
    codeOfConduct: typeof blob.codeOfConduct === "string" ? blob.codeOfConduct : undefined,
    faqNotes: typeof blob.faqNotes === "string" ? blob.faqNotes : undefined,
    socialLinks:
      typeof blob.socialLinks === "object" && blob.socialLinks !== null
        ? (blob.socialLinks as OrganizerConference["socialLinks"])
        : {
            website: event.organizerConfig?.websiteUrl ?? undefined,
            instagram: event.organizerConfig?.instagramUrl ?? undefined,
            linkedin: event.organizerConfig?.linkedinUrl ?? undefined,
            twitter: event.organizerConfig?.twitterUrl ?? undefined,
          },
    brandPrimaryColor: typeof blob.brandPrimaryColor === "string" ? blob.brandPrimaryColor : event.organizerConfig?.brandPrimaryColor ?? undefined,
    brandSecondaryColor:
      typeof blob.brandSecondaryColor === "string"
        ? blob.brandSecondaryColor
        : event.organizerConfig?.brandSecondaryColor ?? undefined,
    bankingDetails:
      typeof blob.bankingDetails === "object" && blob.bankingDetails !== null
        ? (blob.bankingDetails as OrganizerConference["bankingDetails"])
        : undefined,
    statusEmailTemplates:
      typeof blob.statusEmailTemplates === "object" && blob.statusEmailTemplates !== null
        ? (blob.statusEmailTemplates as OrganizerConference["statusEmailTemplates"])
        : undefined,
    status: mapEventStatus(event.status),
    adminRejectionNote:
      typeof blob.adminRejectionNote === "string" && blob.adminRejectionNote.trim()
        ? blob.adminRejectionNote.trim()
        : undefined,
    registrationCategories,
    committees,
    commonDocuments: Array.isArray(blob.commonDocuments) ? (blob.commonDocuments as OrganizerConference["commonDocuments"]) : undefined,
    applicants,
    announcements: blobAnnouncements,
    partnerConferenceIds: Array.isArray(blob.partnerConferenceIds)
      ? (blob.partnerConferenceIds as string[])
      : partnerLinks.filter((p) => p.status === "ACCEPTED").map((p) => p.partnerConferenceId),
    partnerLinks:
      Array.isArray(blob.partnerLinks) && (blob.partnerLinks as OrganizerConferencePartnerLink[]).length > 0
        ? (blob.partnerLinks as OrganizerConferencePartnerLink[])
        : partnerLinks,
    previousEditions: Array.isArray(blob.previousEditions) ? (blob.previousEditions as OrganizerConference["previousEditions"]) : undefined,
    delegationInviteCode: typeof blob.delegationInviteCode === "string" ? blob.delegationInviteCode : undefined,
    organizerTeam:
      Array.isArray(blob.organizerTeam) &&
      (blob.organizerTeam as OrganizerConference["organizerTeam"] | undefined)?.length
        ? (blob.organizerTeam as OrganizerConference["organizerTeam"])
        : event.teamMembers.map((m) => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: String(m.role),
            permissions: [],
          })),
    awards: awards.length ? awards : Array.isArray(blob.awards) ? (blob.awards as OrganizerAwardConfig[]) : undefined,
    reviews: reviews.length ? reviews : Array.isArray(blob.reviews) ? (blob.reviews as ConferenceReview[]) : undefined,
  };

  return recomputeCommitteeAllotments(conference);
}
