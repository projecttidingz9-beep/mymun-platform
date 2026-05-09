"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  ConferenceReview,
  DelegateMunAward,
  DelegateMunParticipation,
  OrganizerAwardConfig,
  OrganizerBankingDetails,
  OrganizerCommittee,
  OrganizerCommitteeQuestion,
  OrganizerDocument,
  OrganizerSocialLinks,
  OrganizerStatusEmailTemplateKey,
  OrganizerStatusEmailTemplates,
  User,
  Registration,
  OrganizerConference,
  OrganizerApplicant,
  OrganizerAnnouncement,
  UserNotification,
} from "./types";
import { hasOrganizerConferenceAccess, isOrganizerUser } from "./organizer-access";

const buildDefaultStatusEmailTemplates = (conferenceTitle: string): OrganizerStatusEmailTemplates => ({
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

const normalizeStatusEmailTemplates = (
  raw: unknown,
  conferenceTitle: string
): OrganizerStatusEmailTemplates => {
  const defaults = buildDefaultStatusEmailTemplates(conferenceTitle);
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const readTemplate = (key: OrganizerStatusEmailTemplateKey) => {
    const maybeTemplate = value[key];
    if (!maybeTemplate || typeof maybeTemplate !== "object") return defaults[key];
    const template = maybeTemplate as Record<string, unknown>;
    const subject =
      typeof template.subject === "string" && template.subject.trim()
        ? template.subject
        : defaults[key].subject;
    const body =
      typeof template.body === "string" && template.body.trim()
        ? template.body
        : defaults[key].body;
    return { subject, body };
  };

  return {
    allotted: readTemplate("allotted"),
    rejected: readTemplate("rejected"),
    waitlisted: readTemplate("waitlisted"),
    invited: readTemplate("invited"),
  };
};

const statusToTemplateKey = (
  status: OrganizerApplicant["status"]
): OrganizerStatusEmailTemplateKey | null => {
  if (status === "Allotted") return "allotted";
  if (status === "Rejected") return "rejected";
  if (status === "Waitlisted") return "waitlisted";
  if (status === "Invited") return "invited";
  return null;
};

const getCommitteeTypeLabel = (committee: Partial<OrganizerCommittee>): string => {
  if (committee.committeeType === "UN") return "UN";
  if (committee.committeeType === "NON_UN") return "Non-UN";
  if (committee.committeeType === "CUSTOM") {
    return committee.customTypeLabel?.trim() || committee.type?.trim() || "Custom";
  }
  const legacyType = committee.type?.trim();
  if (!legacyType) return "UN";
  if (legacyType.toLowerCase() === "un") return "UN";
  if (legacyType.toLowerCase() === "non-un" || legacyType.toLowerCase() === "non un") return "Non-UN";
  return legacyType;
};

const normalizeCommitteeType = (
  rawCommittee: Record<string, unknown>
): Pick<OrganizerCommittee, "committeeType" | "customTypeLabel" | "type" | "memberMode"> => {
  const normalizedType = typeof rawCommittee.committeeType === "string"
    ? rawCommittee.committeeType.toUpperCase()
    : "";
  const normalizedMemberMode = typeof rawCommittee.memberMode === "string"
    ? rawCommittee.memberMode.toUpperCase()
    : "";
  const customTypeLabel = rawCommittee.customTypeLabel
    ? String(rawCommittee.customTypeLabel).trim()
    : "";
  const legacyType = rawCommittee.type ? String(rawCommittee.type).trim() : "";
  const inferMemberMode = (committeeType: OrganizerCommittee["committeeType"]): OrganizerCommittee["memberMode"] =>
    normalizedMemberMode === "UN_COUNTRY" || normalizedMemberMode === "CUSTOM_MEMBER"
      ? (normalizedMemberMode as OrganizerCommittee["memberMode"])
      : committeeType === "UN"
        ? "UN_COUNTRY"
        : "CUSTOM_MEMBER";

  if (normalizedType === "UN") {
    return { committeeType: "UN", customTypeLabel: undefined, type: "UN", memberMode: inferMemberMode("UN") };
  }
  if (normalizedType === "NON_UN") {
    return {
      committeeType: "NON_UN",
      customTypeLabel: undefined,
      type: "Non-UN",
      memberMode: inferMemberMode("NON_UN"),
    };
  }
  if (normalizedType === "CUSTOM") {
    const customLabel = customTypeLabel || legacyType || "Custom";
    return {
      committeeType: "CUSTOM",
      customTypeLabel: customLabel,
      type: customLabel,
      memberMode: inferMemberMode("CUSTOM"),
    };
  }
  if (!legacyType || legacyType.toLowerCase() === "un") {
    return { committeeType: "UN", customTypeLabel: undefined, type: "UN", memberMode: inferMemberMode("UN") };
  }
  if (legacyType.toLowerCase() === "non-un" || legacyType.toLowerCase() === "non un") {
    return {
      committeeType: "NON_UN",
      customTypeLabel: undefined,
      type: "Non-UN",
      memberMode: inferMemberMode("NON_UN"),
    };
  }
  return {
    committeeType: "CUSTOM",
    customTypeLabel: legacyType,
    type: legacyType,
    memberMode: inferMemberMode("CUSTOM"),
  };
};

const normalizeDocuments = (raw: unknown, fallbackPrefix: string): OrganizerDocument[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const document = item as Record<string, unknown>;
      const title = String(document.title ?? "").trim();
      const url = String(document.url ?? "").trim();
      if (!title || !url) return null;
      return {
        id: String(document.id ?? `${fallbackPrefix}-${index}`),
        title,
        category:
          document.category === "background-guide" ||
          document.category === "guidelines" ||
          document.category === "rules"
            ? document.category
            : "other",
        sourceType: document.sourceType === "upload" ? "upload" : "url",
        url,
        fileName: document.fileName ? String(document.fileName) : undefined,
        mimeType: document.mimeType ? String(document.mimeType) : undefined,
        uploadedAt: document.uploadedAt ? String(document.uploadedAt) : undefined,
      } as OrganizerDocument;
    })
    .filter((entry): entry is OrganizerDocument => !!entry);
};

const normalizeOrganizerConference = (raw: unknown): OrganizerConference | null => {
  if (!raw || typeof raw !== "object") return null;
  const conference = raw as Record<string, unknown>;

  const legacyFee = typeof conference.registrationFee === "number" ? conference.registrationFee : 0;

  const committees = Array.isArray(conference.committees)
    ? conference.committees.map((item, index) => {
        const committee = item as Record<string, unknown>;
        const portfolios = Array.isArray(committee.portfolios)
          ? committee.portfolios.map((portfolio, portfolioIndex) => {
              const rawPortfolio = portfolio as Record<string, unknown>;
              const assignedApplicantIds = Array.isArray(rawPortfolio.assignedApplicantIds)
                ? rawPortfolio.assignedApplicantIds.map((id) => String(id))
                : rawPortfolio.assignedApplicantId
                  ? [String(rawPortfolio.assignedApplicantId)]
                  : [];
              return {
                id: String(rawPortfolio.id ?? `pf-${index}-${portfolioIndex}`),
                name: String(rawPortfolio.name ?? `Portfolio ${portfolioIndex + 1}`),
                seatCount: Number(rawPortfolio.seatCount ?? 1),
                assignedApplicantIds,
              };
            })
          : [];
        return {
          id: String(committee.id ?? `cm-${index}`),
          name: String(committee.name ?? "Committee"),
          agenda: String(committee.agenda ?? committee.topic ?? "Agenda will be announced"),
          description: committee.description ? String(committee.description) : undefined,
          logoImageUrl: committee.logoImageUrl ? String(committee.logoImageUrl) : undefined,
          ...normalizeCommitteeType(committee),
          seatCount: Number(committee.seatCount ?? committee.size ?? 0),
          allottedCount: Number(committee.allottedCount ?? 0),
          basePrice:
            committee.basePrice === undefined ? undefined : Number(committee.basePrice),
          chairName: committee.chairName ? String(committee.chairName) : undefined,
          chairEmail: committee.chairEmail ? String(committee.chairEmail) : undefined,
          isPublic: committee.isPublic === undefined ? true : Boolean(committee.isPublic),
          customQuestions: Array.isArray(committee.customQuestions)
            ? committee.customQuestions.map((question, questionIndex) => {
                const rawQuestion = question as Record<string, unknown>;
                return {
                  id: String(rawQuestion.id ?? `q-${index}-${questionIndex}`),
                  question: String(rawQuestion.question ?? ""),
                  required: Boolean(rawQuestion.required),
                } as OrganizerCommitteeQuestion;
              })
            : [],
          chairs: Array.isArray(committee.chairs)
            ? committee.chairs.map((chair, chairIndex) => {
                const rawChair = chair as Record<string, unknown>;
                return {
                  id: String(rawChair.id ?? `chair-${index}-${chairIndex}`),
                  name: String(rawChair.name ?? ""),
                  email: rawChair.email ? String(rawChair.email) : undefined,
                  role: rawChair.role ? String(rawChair.role) : undefined,
                };
              }).filter((chair) => chair.name.trim())
            : committee.chairName
              ? [
                  {
                    id: `chair-${index}-0`,
                    name: String(committee.chairName),
                    email: committee.chairEmail ? String(committee.chairEmail) : undefined,
                    role: "Chair",
                  },
                ]
              : [],
          portfolios,
          documents: normalizeDocuments(committee.documents, `cm-doc-${index}`),
        };
      })
    : [];

  const registrationCategories = Array.isArray(conference.registrationCategories)
    ? conference.registrationCategories.map((entry, index) => {
        const category = entry as Record<string, unknown>;
        const rawApplicationType = typeof category.applicationType === "string"
          ? category.applicationType.trim().toLowerCase()
          : "";
        const normalizedApplicationType =
          rawApplicationType === "delegate" ||
          rawApplicationType === "chair" ||
          rawApplicationType === "delegation" ||
          rawApplicationType === "organizer" ||
          rawApplicationType === "other"
            ? (rawApplicationType as "delegate" | "chair" | "delegation" | "organizer" | "other")
            : "delegate";
        const normalizedDeadlineOverride =
          typeof category.deadlineOverride === "string" && category.deadlineOverride.trim()
            ? category.deadlineOverride
            : undefined;
        const rawMaxDelegates =
          typeof category.maxDelegatesPerDelegation === "number"
            ? category.maxDelegatesPerDelegation
            : typeof category.maxDelegatesPerDelegation === "string"
              ? Number(category.maxDelegatesPerDelegation)
              : undefined;
        const normalizedMaxDelegates =
          rawMaxDelegates !== undefined &&
          Number.isFinite(rawMaxDelegates) &&
          rawMaxDelegates > 0
            ? Math.floor(rawMaxDelegates)
            : undefined;
        return {
          ...category,
          id: String(category.id ?? `cat-${index}`),
          name: String(category.name ?? "Registration Category"),
          description: String(category.description ?? ""),
          basePrice: Number(category.basePrice ?? 0),
          requiresCommitteeSelection:
            category.requiresCommitteeSelection === undefined
              ? true
              : Boolean(category.requiresCommitteeSelection),
          applicationType: normalizedApplicationType,
          isOpen: category.isOpen === undefined ? true : Boolean(category.isOpen),
          deadlineOverride: normalizedDeadlineOverride,
          formFields: Array.isArray(category.formFields) ? category.formFields : [],
          pricingPhases: Array.isArray(category.pricingPhases) ? category.pricingPhases : [],
          maxDelegatesPerDelegation: normalizedMaxDelegates,
        };
      })
    : [
        {
          id: "cat-delegate",
          name: "Delegate Registration",
          description: "Default registration category migrated from legacy event format.",
          basePrice: legacyFee,
          applicationType: "delegate",
          isOpen: true,
          deadlineOverride: undefined,
          requiresCommitteeSelection: true,
          formFields: [],
          pricingPhases: [],
        },
        {
          id: "cat-chair",
          name: "Chair Registration",
          description: "Executive board and chair applications.",
          basePrice: legacyFee,
          applicationType: "chair",
          isOpen: true,
          deadlineOverride: undefined,
          requiresCommitteeSelection: true,
          formFields: [],
          pricingPhases: [],
        },
        {
          id: "cat-delegation",
          name: "Delegation Registration",
          description: "Register an entire delegation.",
          basePrice: legacyFee,
          applicationType: "delegation",
          isOpen: true,
          deadlineOverride: undefined,
          requiresCommitteeSelection: true,
          formFields: [],
          pricingPhases: [],
          maxDelegatesPerDelegation: 10,
        },
        {
          id: "cat-organizer",
          name: "Organising Committee Registration",
          description: "Internal organising team onboarding category.",
          basePrice: 0,
          applicationType: "organizer",
          isOpen: true,
          deadlineOverride: undefined,
          requiresCommitteeSelection: false,
          formFields: [],
          pricingPhases: [],
        },
      ];

  const applicants = Array.isArray(conference.applicants)
    ? conference.applicants.map((item, index) => {
        const applicant = item as Record<string, unknown>;
        const legacyPreference = String(applicant.committeePreference ?? "");
        const committeePreferences = Array.isArray(applicant.committeePreferences)
          ? applicant.committeePreferences.map((value) => String(value))
          : legacyPreference
            ? [legacyPreference]
            : [];
        return {
          id: String(applicant.id ?? `app-${index}`),
          name: String(applicant.name ?? "Applicant"),
          school: String(applicant.school ?? ""),
          countryPreference: String(applicant.countryPreference ?? ""),
          committeePreference: legacyPreference,
          committeePreferences,
          portfolioPreferencesByCommittee:
            typeof applicant.portfolioPreferencesByCommittee === "object" &&
            applicant.portfolioPreferencesByCommittee !== null
              ? (applicant.portfolioPreferencesByCommittee as Record<string, string[]>)
              : {},
          categoryId: applicant.categoryId ? String(applicant.categoryId) : undefined,
          categoryName: applicant.categoryName ? String(applicant.categoryName) : undefined,
          assignmentStatus:
            (applicant.assignmentStatus as OrganizerApplicant["status"]) ??
            (applicant.status as OrganizerApplicant["status"]) ??
            "Pending",
          assignedCommitteeId: applicant.assignedCommitteeId ? String(applicant.assignedCommitteeId) : undefined,
          assignedCommitteeName: applicant.assignedCommitteeName ? String(applicant.assignedCommitteeName) : undefined,
          assignedPortfolioId: applicant.assignedPortfolioId ? String(applicant.assignedPortfolioId) : undefined,
          assignedPortfolioName: applicant.assignedPortfolioName ? String(applicant.assignedPortfolioName) : undefined,
          assignedAt: applicant.assignedAt ? String(applicant.assignedAt) : undefined,
          overrideUsed: Boolean(applicant.overrideUsed),
          assignmentHistory: Array.isArray(applicant.assignmentHistory)
            ? (applicant.assignmentHistory as OrganizerApplicant["assignmentHistory"])
            : [],
          responses:
            typeof applicant.responses === "object" && applicant.responses !== null
              ? (applicant.responses as Record<string, string | number | boolean | string[]>)
              : {},
          phone: applicant.phone ? String(applicant.phone) : undefined,
          paid: Boolean(applicant.paid),
          amount: applicant.amount === undefined ? undefined : Number(applicant.amount),
          registrationId: applicant.registrationId ? String(applicant.registrationId) : undefined,
          registeredAt: applicant.registeredAt ? String(applicant.registeredAt) : undefined,
          userId: applicant.userId ? String(applicant.userId) : undefined,
          userEmail: applicant.userEmail ? String(applicant.userEmail) : undefined,
          status: (applicant.status as OrganizerApplicant["status"]) ?? "Pending",
        };
      })
    : [];

  const bankingDetailsRaw =
    typeof conference.bankingDetails === "object" && conference.bankingDetails !== null
      ? (conference.bankingDetails as Record<string, unknown>)
      : null;
  const bankingDetails: OrganizerBankingDetails | undefined = bankingDetailsRaw
    ? {
        accountHolderName: bankingDetailsRaw.accountHolderName
          ? String(bankingDetailsRaw.accountHolderName).trim()
          : undefined,
        bankName: bankingDetailsRaw.bankName ? String(bankingDetailsRaw.bankName).trim() : undefined,
        accountNumber: bankingDetailsRaw.accountNumber
          ? String(bankingDetailsRaw.accountNumber).trim()
          : undefined,
        accountType:
          bankingDetailsRaw.accountType === "Savings" ||
          bankingDetailsRaw.accountType === "Current" ||
          bankingDetailsRaw.accountType === "Checking" ||
          bankingDetailsRaw.accountType === "Other"
            ? bankingDetailsRaw.accountType
            : undefined,
        ifscCode: bankingDetailsRaw.ifscCode ? String(bankingDetailsRaw.ifscCode).trim() : undefined,
        swiftCode: bankingDetailsRaw.swiftCode ? String(bankingDetailsRaw.swiftCode).trim() : undefined,
        iban: bankingDetailsRaw.iban ? String(bankingDetailsRaw.iban).trim() : undefined,
        routingNumber: bankingDetailsRaw.routingNumber
          ? String(bankingDetailsRaw.routingNumber).trim()
          : undefined,
        branchName: bankingDetailsRaw.branchName ? String(bankingDetailsRaw.branchName).trim() : undefined,
        branchAddress: bankingDetailsRaw.branchAddress
          ? String(bankingDetailsRaw.branchAddress).trim()
          : undefined,
        upiId: bankingDetailsRaw.upiId ? String(bankingDetailsRaw.upiId).trim() : undefined,
        payoutNotes: bankingDetailsRaw.payoutNotes ? String(bankingDetailsRaw.payoutNotes) : undefined,
        verificationStatus:
          bankingDetailsRaw.verificationStatus === "Pending" || bankingDetailsRaw.verificationStatus === "Verified"
            ? bankingDetailsRaw.verificationStatus
            : "Unverified",
        updatedAt: bankingDetailsRaw.updatedAt ? String(bankingDetailsRaw.updatedAt) : undefined,
      }
    : undefined;

  return {
    id: String(conference.id ?? `org-${Date.now()}`),
    ownerUserId:
      conference.ownerUserId === undefined ? undefined : String(conference.ownerUserId),
    ownerEmail:
      conference.ownerEmail === undefined ? undefined : String(conference.ownerEmail),
    title: String(conference.title ?? "Untitled Conference"),
    city: String(conference.city ?? ""),
    country: String(conference.country ?? ""),
    organizerName: String(conference.organizerName ?? ""),
    contactDetail:
      conference.contactDetail === undefined ? undefined : String(conference.contactDetail),
    tags: Array.isArray(conference.tags) ? conference.tags.map((entry) => String(entry)) : [],
    level: (conference.level as OrganizerConference["level"]) ?? "Open",
    capacity: Number(conference.capacity ?? 0),
    startDate: String(conference.startDate ?? ""),
    endDate: String(conference.endDate ?? ""),
    whatIsIncluded: Array.isArray(conference.whatIsIncluded)
      ? conference.whatIsIncluded.map((item) => String(item)).filter(Boolean)
      : [],
    conferenceSchedule: Array.isArray(conference.conferenceSchedule)
      ? conference.conferenceSchedule.map((entry, index) => {
          const item = entry as Record<string, unknown>;
          return {
            id: String(item.id ?? `schedule-${index}`),
            day: String(item.day ?? ""),
            fromTime: String(item.fromTime ?? ""),
            toTime: String(item.toTime ?? ""),
            title: String(item.title ?? ""),
          };
        })
      : [],
    registrationDeadline:
      conference.registrationDeadline === undefined
        ? undefined
        : String(conference.registrationDeadline),
    venue: conference.venue === undefined ? undefined : String(conference.venue),
    logoImageUrl:
      typeof conference.logoImageUrl === "string" && conference.logoImageUrl.trim()
        ? conference.logoImageUrl
        : undefined,
    bannerImageUrl:
      typeof conference.bannerImageUrl === "string" && conference.bannerImageUrl.trim()
        ? conference.bannerImageUrl
        : undefined,
    bannerSourceType:
      conference.bannerSourceType === "upload" || conference.bannerSourceType === "url"
        ? conference.bannerSourceType
        : undefined,
    description: conference.description === undefined ? undefined : String(conference.description),
    termsAndConditions:
      conference.termsAndConditions === undefined
        ? undefined
        : String(conference.termsAndConditions),
    refundPolicy: conference.refundPolicy === undefined ? undefined : String(conference.refundPolicy),
    codeOfConduct:
      conference.codeOfConduct === undefined ? undefined : String(conference.codeOfConduct),
    faqNotes: conference.faqNotes === undefined ? undefined : String(conference.faqNotes),
    socialLinks:
      typeof conference.socialLinks === "object" && conference.socialLinks !== null
        ? (conference.socialLinks as OrganizerSocialLinks)
        : undefined,
    brandPrimaryColor:
      conference.brandPrimaryColor === undefined ? undefined : String(conference.brandPrimaryColor),
    brandSecondaryColor:
      conference.brandSecondaryColor === undefined ? undefined : String(conference.brandSecondaryColor),
    bankingDetails,
    statusEmailTemplates: normalizeStatusEmailTemplates(
      conference.statusEmailTemplates,
      String(conference.title ?? "Conference")
    ),
    commonDocuments: normalizeDocuments(conference.commonDocuments, "common-doc"),
    partnerConferenceIds: Array.isArray(conference.partnerConferenceIds)
      ? conference.partnerConferenceIds.map((entry) => String(entry))
      : [],
    partnerLinks: Array.isArray(conference.partnerLinks)
      ? conference.partnerLinks.map((entry, index) => {
          const link = entry as Record<string, unknown>;
          return {
            id: String(link.id ?? `partner-link-${index}`),
            partnerConferenceId: String(link.partnerConferenceId ?? ""),
            partnerConferenceTitle: link.partnerConferenceTitle
              ? String(link.partnerConferenceTitle)
              : undefined,
            direction: link.direction === "incoming" ? "incoming" : "outgoing",
            status:
              link.status === "ACCEPTED" ||
              link.status === "REJECTED" ||
              link.status === "CANCELLED"
                ? link.status
                : "PENDING",
            createdAt: link.createdAt ? String(link.createdAt) : undefined,
            updatedAt: link.updatedAt ? String(link.updatedAt) : undefined,
          };
        })
      : [],
    previousEditions: Array.isArray(conference.previousEditions)
      ? conference.previousEditions.map((entry, index) => {
          const edition = entry as Record<string, unknown>;
          return {
            id: String(edition.id ?? `ed-${index}`),
            year: String(edition.year ?? ""),
            title: String(edition.title ?? ""),
            delegates: Number(edition.delegates ?? 0),
            highlights: edition.highlights ? String(edition.highlights) : undefined,
          };
        })
      : [],
    delegationInviteCode: conference.delegationInviteCode
      ? String(conference.delegationInviteCode)
      : undefined,
    organizerTeam: Array.isArray(conference.organizerTeam)
      ? conference.organizerTeam.map((entry, index) => {
          const member = entry as Record<string, unknown>;
          return {
            id: String(member.id ?? `team-${index}`),
            userId: member.userId ? String(member.userId) : undefined,
            name: String(member.name ?? ""),
            email: String(member.email ?? ""),
            role:
              member.role === "USG" ||
              member.role === "Logistics Head" ||
              member.role === "Committee Head"
                ? member.role
                : "Lead Organizer",
            permissions: Array.isArray(member.permissions)
              ? member.permissions.map((permission) => String(permission)) as (
                  | "view"
                  | "applications"
                  | "finance"
                  | "settings"
                  | "publishing"
                )[]
              : ["view"],
          };
        })
      : [],
    awards: Array.isArray(conference.awards)
      ? conference.awards.map((entry, index) => {
          const award = entry as Record<string, unknown>;
          return {
            id: String(award.id ?? `award-${index}`),
            category: String(award.category ?? ""),
            prizeTitle: award.prizeTitle ? String(award.prizeTitle) : undefined,
            sponsorName: award.sponsorName ? String(award.sponsorName) : undefined,
            sponsorLogoUrl: award.sponsorLogoUrl ? String(award.sponsorLogoUrl) : undefined,
            description: award.description ? String(award.description) : undefined,
            participantId: award.participantId ? String(award.participantId) : undefined,
            participantName: award.participantName ? String(award.participantName) : undefined,
            participantUserId: award.participantUserId ? String(award.participantUserId) : undefined,
            participantUserEmail: award.participantUserEmail ? String(award.participantUserEmail) : undefined,
          };
        })
      : [],
    reviews: Array.isArray(conference.reviews)
      ? conference.reviews.map((entry, index) => {
          const review = entry as Record<string, unknown>;
          return {
            id: String(review.id ?? `review-${index}`),
            conferenceId: String(review.conferenceId ?? conference.id ?? ""),
            userId: review.userId ? String(review.userId) : undefined,
            userName: String(review.userName ?? "Anonymous"),
            rating: Number(review.rating ?? 0),
            organizationRating:
              review.organizationRating === undefined ? undefined : Number(review.organizationRating),
            committeeRating:
              review.committeeRating === undefined ? undefined : Number(review.committeeRating),
            hospitalityRating:
              review.hospitalityRating === undefined ? undefined : Number(review.hospitalityRating),
            comment: String(review.comment ?? ""),
            status:
              review.status === "approved" || review.status === "hidden" ? review.status : "pending",
            featured: Boolean(review.featured),
            createdAt: String(review.createdAt ?? new Date().toISOString()),
          } as ConferenceReview;
        })
      : [],
    status: (conference.status as OrganizerConference["status"]) ?? "Draft",
    registrationCategories: registrationCategories as OrganizerConference["registrationCategories"],
    committees,
    applicants,
    announcements: (conference.announcements ?? []) as OrganizerAnnouncement[],
  };
};

const recomputeCommitteeAllotments = (conference: OrganizerConference): OrganizerConference => {
  const allotments = new Map<string, number>();
  for (const applicant of conference.applicants) {
    if (applicant.status !== "Allotted" || !applicant.assignedCommitteeId) continue;
    allotments.set(
      applicant.assignedCommitteeId,
      (allotments.get(applicant.assignedCommitteeId) ?? 0) + 1
    );
  }

  return {
    ...conference,
    committees: conference.committees.map((committee) => ({
      ...committee,
      allottedCount: allotments.get(committee.id) ?? 0,
      portfolios: (committee.portfolios ?? []).map((portfolio) => ({
        ...portfolio,
        assignedApplicantIds: portfolio.assignedApplicantIds ?? [],
      })),
    })),
  };
};

const normalizeUser = (raw: unknown): User | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const readOptionalString = (candidate: unknown) => {
    if (typeof candidate !== "string") return undefined;
    const trimmed = candidate.trim();
    return trimmed ? trimmed : undefined;
  };

  const participations: DelegateMunParticipation[] = Array.isArray(value.munParticipations)
    ? value.munParticipations.map((entry, index) => {
        const item = entry as Record<string, unknown>;
        return {
          id: String(item.id ?? `mun-part-${index}`),
          conferenceName: String(item.conferenceName ?? ""),
          committee: item.committee ? String(item.committee) : undefined,
          role: item.role ? String(item.role) : undefined,
          year: item.year === undefined ? undefined : Number(item.year),
          countryRepresented: item.countryRepresented ? String(item.countryRepresented) : undefined,
          notes: item.notes ? String(item.notes) : undefined,
          certificateUrl: item.certificateUrl ? String(item.certificateUrl) : undefined,
          certificateFileName: item.certificateFileName ? String(item.certificateFileName) : undefined,
          certificateMimeType: item.certificateMimeType ? String(item.certificateMimeType) : undefined,
        };
      })
    : [];

  const awards: DelegateMunAward[] = Array.isArray(value.munAwards)
    ? value.munAwards.map((entry, index) => {
        const item = entry as Record<string, unknown>;
        return {
          id: String(item.id ?? `mun-award-${index}`),
          title: String(item.title ?? ""),
          conferenceName: String(item.conferenceName ?? ""),
          year: item.year === undefined ? undefined : Number(item.year),
          category: item.category ? String(item.category) : undefined,
          committee: item.committee ? String(item.committee) : undefined,
          logoUrl: item.logoUrl ? String(item.logoUrl) : undefined,
        };
      })
    : [];

  return {
    id: String(value.id ?? ""),
    name: String(value.name ?? ""),
    email: String(value.email ?? ""),
    role:
      value.role === "organizer" || value.role === "admin"
        ? value.role
        : "delegate",
    avatar: String(value.avatar ?? "U"),
    profileImageUrl: readOptionalString(value.profileImageUrl),
    firstName: readOptionalString(value.firstName),
    lastName: readOptionalString(value.lastName),
    school: String(value.school ?? ""),
    college: readOptionalString(value.college),
    fieldOfStudy: readOptionalString(value.fieldOfStudy),
    profileHeadline: readOptionalString(value.profileHeadline),
    phone: readOptionalString(value.phone),
    city: readOptionalString(value.city),
    state: readOptionalString(value.state),
    postalCode: readOptionalString(value.postalCode),
    socialMedia:
      typeof value.socialMedia === "object" && value.socialMedia !== null
        ? {
            instagram: readOptionalString((value.socialMedia as Record<string, unknown>).instagram),
            linkedin: readOptionalString((value.socialMedia as Record<string, unknown>).linkedin),
            twitter: readOptionalString((value.socialMedia as Record<string, unknown>).twitter),
            github: readOptionalString((value.socialMedia as Record<string, unknown>).github),
          }
        : undefined,
    invoiceAddress:
      typeof value.invoiceAddress === "object" && value.invoiceAddress !== null
        ? {
            line1: readOptionalString((value.invoiceAddress as Record<string, unknown>).line1),
            line2: readOptionalString((value.invoiceAddress as Record<string, unknown>).line2),
            city: readOptionalString((value.invoiceAddress as Record<string, unknown>).city),
            state: readOptionalString((value.invoiceAddress as Record<string, unknown>).state),
            postalCode: readOptionalString((value.invoiceAddress as Record<string, unknown>).postalCode),
            country: readOptionalString((value.invoiceAddress as Record<string, unknown>).country),
          }
        : undefined,
    country: String(value.country ?? ""),
    munExperienceSummary: value.munExperienceSummary ? String(value.munExperienceSummary) : "",
    munAwardsSummary: value.munAwardsSummary ? String(value.munAwardsSummary) : "",
    munParticipations: participations,
    munAwards: awards,
    profileVisibility: value.profileVisibility === "private" ? "private" : "public",
    registeredConferences: Array.isArray(value.registeredConferences)
      ? (value.registeredConferences as Registration[])
      : [],
    notifications: Array.isArray(value.notifications)
      ? (value.notifications as UserNotification[])
      : [],
  };
};

const normalizeEmail = (value: string | undefined | null) => (value || "").trim().toLowerCase();

const getOrganizerConferencesStorageKey = (identity: { id?: string | null; email?: string | null }) => {
  const id = (identity.id || "").trim();
  const email = normalizeEmail(identity.email);
  if (id) return `tidingz_organizer_conferences:${id}`;
  if (email) return `tidingz_organizer_conferences:${email}`;
  return "tidingz_organizer_conferences:anonymous";
};

const stampOwnershipIfMissing = (
  conference: OrganizerConference,
  identity: { id?: string | null; email?: string | null }
): OrganizerConference => {
  if (conference.ownerUserId || conference.ownerEmail) return conference;
  return {
    ...conference,
    ownerUserId: identity.id || undefined,
    ownerEmail: identity.email || undefined,
  };
};

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  /** True after client mount — avoids blank flashes before localStorage hydrates. */
  authReady: boolean;
  organizerConferences: OrganizerConference[];
  login: (email: string, name?: string, role?: "delegate" | "organizer" | "admin") => void;
  logout: () => void;
  addRegistration: (reg: Registration) => void;
  addOrganizerConference: (
    payload: Omit<OrganizerConference, "id" | "status" | "applicants" | "announcements">
  ) => void;
  removeOrganizerConference: (conferenceId: string) => void;
  updateOrganizerConferenceStatus: (conferenceId: string, status: OrganizerConference["status"]) => void;
  updateOrganizerConferenceConfig: (
    conferenceId: string,
    patch: Partial<
      Pick<
        OrganizerConference,
        | "title"
        | "capacity"
        | "level"
        | "city"
        | "country"
        | "organizerName"
        | "contactDetail"
        | "tags"
        | "venue"
        | "startDate"
        | "endDate"
        | "description"
        | "termsAndConditions"
        | "refundPolicy"
        | "codeOfConduct"
        | "faqNotes"
        | "logoImageUrl"
        | "bannerImageUrl"
        | "bannerSourceType"
        | "socialLinks"
        | "brandPrimaryColor"
        | "brandSecondaryColor"
        | "bankingDetails"
        | "partnerConferenceIds"
        | "partnerLinks"
        | "previousEditions"
        | "delegationInviteCode"
        | "organizerTeam"
        | "awards"
        | "reviews"
        | "statusEmailTemplates"
        | "commonDocuments"
        | "whatIsIncluded"
        | "conferenceSchedule"
      >
    >
  ) => void;
  updateOrganizerCommitteeConfig: (
    conferenceId: string,
    committeeId: string,
    patch: Partial<OrganizerCommittee>
  ) => void;
  addOrganizerCommittee: (conferenceId: string, committee: Omit<OrganizerCommittee, "id" | "allottedCount">) => void;
  removeOrganizerCommittee: (conferenceId: string, committeeId: string) => void;
  updateRegistrationCategoryConfig: (
    conferenceId: string,
    categoryId: string,
    patch: Partial<OrganizerConference["registrationCategories"][number]>
  ) => void;
  addConferenceReview: (
    conferenceId: string,
    payload: Omit<ConferenceReview, "id" | "conferenceId" | "status" | "featured" | "createdAt">
  ) => void;
  moderateConferenceReview: (
    conferenceId: string,
    reviewId: string,
    patch: Partial<Pick<ConferenceReview, "status" | "featured">>
  ) => void;
  removeConferenceReview: (conferenceId: string, reviewId: string, userId: string) => void;
  addConferenceAward: (conferenceId: string, award: Omit<OrganizerAwardConfig, "id">) => void;
  removeConferenceAward: (conferenceId: string, awardId: string) => void;
  updateApplicantStatus: (conferenceId: string, applicantId: string, status: OrganizerApplicant["status"]) => void;
  toggleApplicantPayment: (conferenceId: string, applicantId: string) => void;
  addAnnouncement: (conferenceId: string, title: string, message: string) => void;
  assignApplicant: (payload: {
    conferenceId: string;
    applicantId: string;
    committeeId: string;
    portfolioId?: string;
    allowOverride?: boolean;
  }) => { ok: boolean; message: string };
  moveApplicant: (payload: {
    conferenceId: string;
    applicantId: string;
    committeeId: string;
    portfolioId?: string;
    allowOverride?: boolean;
  }) => { ok: boolean; message: string };
  unassignApplicant: (conferenceId: string, applicantId: string) => { ok: boolean; message: string };
  waitlistApplicant: (conferenceId: string, applicantId: string) => { ok: boolean; message: string };
  inviteApplicant: (conferenceId: string, applicantId: string) => { ok: boolean; message: string };
  overrideSeatLimit: (conferenceId: string, committeeId: string, seatCount: number) => void;
  notifications: UserNotification[];
  markNotificationRead: (notificationId: string) => void;
  updateDelegateProfile: (patch: {
    profileImageUrl?: string;
    firstName?: string;
    lastName?: string;
    school?: string;
    college?: string;
    fieldOfStudy?: string;
    profileHeadline?: string;
    phone?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    socialMedia?: {
      instagram?: string;
      linkedin?: string;
      twitter?: string;
      github?: string;
    };
    invoiceAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    country?: string;
    munExperienceSummary?: string;
    munAwardsSummary?: string;
    munParticipations?: DelegateMunParticipation[];
    munAwards?: DelegateMunAward[];
    profileVisibility?: "private" | "public";
  }) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  authReady: false,
  organizerConferences: [],
  login: () => {},
  logout: () => {},
  addRegistration: () => {},
  addOrganizerConference: () => {},
  removeOrganizerConference: () => {},
  updateOrganizerConferenceStatus: () => {},
  updateOrganizerConferenceConfig: () => {},
  updateOrganizerCommitteeConfig: () => {},
  addOrganizerCommittee: () => {},
  removeOrganizerCommittee: () => {},
  updateRegistrationCategoryConfig: () => {},
  addConferenceReview: () => {},
  moderateConferenceReview: () => {},
  removeConferenceReview: () => {},
  addConferenceAward: () => {},
  removeConferenceAward: () => {},
  updateApplicantStatus: () => {},
  toggleApplicantPayment: () => {},
  addAnnouncement: () => {},
  assignApplicant: () => ({ ok: false, message: "Not implemented" }),
  moveApplicant: () => ({ ok: false, message: "Not implemented" }),
  unassignApplicant: () => ({ ok: false, message: "Not implemented" }),
  waitlistApplicant: () => ({ ok: false, message: "Not implemented" }),
  inviteApplicant: () => ({ ok: false, message: "Not implemented" }),
  overrideSeatLimit: () => {},
  notifications: [],
  markNotificationRead: () => {},
  updateDelegateProfile: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setAuthReady(true));
  }, []);

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem("tidingz_user");
    if (!storedUser) return null;
    try {
      const parsed = JSON.parse(storedUser);
      const normalized = normalizeUser(parsed);
      if (!normalized) {
        localStorage.removeItem("tidingz_user");
        return null;
      }
      localStorage.setItem("tidingz_user", JSON.stringify(normalized));
      return normalized;
    } catch {
      localStorage.removeItem("tidingz_user");
      return null;
    }
  });
  const [organizerConferences, setOrganizerConferences] = useState<OrganizerConference[]>(() => {
    if (typeof window === "undefined") return [];
    let storedUser: User | null = null;
    try {
      storedUser = normalizeUser(JSON.parse(localStorage.getItem("tidingz_user") || "null"));
    } catch {
      storedUser = null;
    }
    const storageKey = getOrganizerConferencesStorageKey({
      id: storedUser?.id,
      email: storedUser?.email,
    });
    const storedOrganizerConferences =
      localStorage.getItem(storageKey) || localStorage.getItem("tidingz_organizer_conferences");
    if (!storedOrganizerConferences) return [];
    try {
      const parsed = JSON.parse(storedOrganizerConferences);
      if (!Array.isArray(parsed)) return [];
      const normalized = parsed
        .map((entry) => normalizeOrganizerConference(entry))
        .filter((entry): entry is OrganizerConference => !!entry);
      const withOwner = normalized.map((conference) =>
        stampOwnershipIfMissing(conference, { id: storedUser?.id, email: storedUser?.email })
      );
      localStorage.setItem(storageKey, JSON.stringify(withOwner));
      return withOwner.map(recomputeCommitteeAllotments);
    } catch {
      localStorage.removeItem(storageKey);
      return [];
    }
  });
  const [notifications, setNotifications] = useState<UserNotification[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("tidingz_notifications");
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as UserNotification[]) : [];
    } catch {
      return [];
    }
  });
  const scheduleOrganizerConferenceState = (next: OrganizerConference[]) => {
    window.setTimeout(() => setOrganizerConferences(next), 0);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOrganizerUser(user)) {
      scheduleOrganizerConferenceState([]);
      return;
    }
    const storageKey = getOrganizerConferencesStorageKey({
      id: user?.id,
      email: user?.email,
    });
    let storedOrganizerConferences = localStorage.getItem(storageKey);
    if (!storedOrganizerConferences) {
      const legacy = localStorage.getItem("tidingz_organizer_conferences");
      if (legacy) {
        storedOrganizerConferences = legacy;
      }
    }
    if (!storedOrganizerConferences) {
      scheduleOrganizerConferenceState([]);
      return;
    }
    try {
      const parsed = JSON.parse(storedOrganizerConferences);
      if (!Array.isArray(parsed)) {
        scheduleOrganizerConferenceState([]);
        return;
      }
      const normalized = parsed
        .map((entry) => normalizeOrganizerConference(entry))
        .filter((entry): entry is OrganizerConference => !!entry)
        .map((conference) =>
          stampOwnershipIfMissing(conference, { id: user?.id, email: user?.email })
        )
        .map(recomputeCommitteeAllotments)
        .filter((conference) =>
          hasOrganizerConferenceAccess({ id: user?.id, email: user?.email }, conference)
        );
      localStorage.setItem(storageKey, JSON.stringify(normalized));
      scheduleOrganizerConferenceState(normalized);
    } catch {
      scheduleOrganizerConferenceState([]);
    }
  }, [user, user?.id, user?.email, user?.role]);

  const login: AuthContextType["login"] = (email, name, role = "delegate") => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName =
      name || email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const loggedInUser = normalizeUser({
      id: normalizedEmail,
      email: normalizedEmail,
      name: normalizedName,
      role,
      avatar: normalizedName[0]?.toUpperCase() || "U",
      school: "",
      country: "",
      profileVisibility: "public",
      munParticipations: [],
      munAwards: [],
      registeredConferences: [],
      notifications: [],
    });
    if (!loggedInUser) return;
    setUser(loggedInUser);
    localStorage.setItem("tidingz_user", JSON.stringify(loggedInUser));
    const storageKey = getOrganizerConferencesStorageKey({
      id: loggedInUser.id,
      email: loggedInUser.email,
    });
    let storedOrganizerConferences = localStorage.getItem(storageKey);
    if (!storedOrganizerConferences) {
      const legacy = localStorage.getItem("tidingz_organizer_conferences");
      if (legacy) storedOrganizerConferences = legacy;
    }
    if (!storedOrganizerConferences) {
      setOrganizerConferences([]);
      return;
    }
    try {
      const parsed = JSON.parse(storedOrganizerConferences);
      if (!Array.isArray(parsed)) {
        setOrganizerConferences([]);
        return;
      }
      const normalized = parsed
        .map((entry) => normalizeOrganizerConference(entry))
        .filter((entry): entry is OrganizerConference => !!entry)
        .map((conference) =>
          stampOwnershipIfMissing(conference, { id: loggedInUser.id, email: loggedInUser.email })
        )
        .map(recomputeCommitteeAllotments);
      localStorage.setItem(storageKey, JSON.stringify(normalized));
      setOrganizerConferences(normalized);
    } catch {
      setOrganizerConferences([]);
    }
  };

  const logout = () => {
    setUser(null);
    setOrganizerConferences([]);
    localStorage.removeItem("tidingz_user");
  };

  const addRegistration = (reg: Registration) => {
    if (!user) return;
    const updated = {
      ...user,
      registeredConferences: [...user.registeredConferences, reg],
    };
    setUser(updated);
    localStorage.setItem("tidingz_user", JSON.stringify(updated));

    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== reg.conferenceId) return conference;
      const committeePreferences = reg.committeePreferences && reg.committeePreferences.length > 0
        ? reg.committeePreferences
        : reg.committeeName
          ? [reg.committeeName]
          : [];
      const applicant: OrganizerApplicant = {
        id: `org-ap-${Date.now()}`,
        name: String(reg.formAnswers.fullName ?? updated.name),
        school: String(reg.formAnswers.school ?? updated.school),
        countryPreference: String(reg.country ?? ""),
        committeePreference: committeePreferences[0] ?? "",
        committeePreferences,
        portfolioPreferencesByCommittee: reg.portfolioPreferencesByCommittee ?? {},
        categoryId: reg.categoryId,
        categoryName: reg.categoryName,
        assignmentStatus: "Pending",
        status: "Pending",
        paid: reg.paid,
        amount: reg.amount,
        responses: reg.formAnswers,
        phone:
          typeof reg.formAnswers.phone === "string" ? reg.formAnswers.phone : undefined,
        registrationId: reg.id,
        registeredAt: reg.registeredAt,
        userId: updated.id,
        userEmail: updated.email,
      };
      return {
        ...conference,
        applicants: [applicant, ...conference.applicants],
      };
    });
    persistOrganizerConferences(next);
  };

  const persistOrganizerConferences = (next: OrganizerConference[]) => {
    const normalized = next.map(recomputeCommitteeAllotments);
    const storageKey = getOrganizerConferencesStorageKey({
      id: user?.id,
      email: user?.email,
    });
    localStorage.setItem(storageKey, JSON.stringify(normalized));
    if (!isOrganizerUser(user)) {
      setOrganizerConferences([]);
      return;
    }
    setOrganizerConferences(
      normalized.filter((conference) =>
        hasOrganizerConferenceAccess(
          { id: user?.id, email: user?.email },
          conference
        )
      )
    );
  };

  const triggerStatusEmail = ({
    conference,
    applicant,
    status,
    assignedCommitteeName,
    assignedPortfolioName,
  }: {
    conference: OrganizerConference;
    applicant: OrganizerApplicant;
    status: OrganizerApplicant["status"];
    assignedCommitteeName?: string;
    assignedPortfolioName?: string;
  }) => {
    const templateKey = statusToTemplateKey(status);
    if (!templateKey) return;
    const recipientEmail = applicant.userEmail || user?.email;
    if (!recipientEmail) return;
    const templates = conference.statusEmailTemplates || buildDefaultStatusEmailTemplates(conference.title);
    const selectedTemplate = templates[templateKey];
    if (!selectedTemplate?.subject?.trim() || !selectedTemplate?.body?.trim()) return;

    void fetch("/api/organizers/send-status-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        eventId: conference.id,
        to: recipientEmail,
        templateKey,
        subjectTemplate: selectedTemplate.subject,
        bodyTemplate: selectedTemplate.body,
        context: {
          applicantName: applicant.name,
          conferenceTitle: conference.title,
          status,
          assignedCommittee: assignedCommitteeName || applicant.assignedCommitteeName || "Not assigned",
          assignedPortfolio: assignedPortfolioName || applicant.assignedPortfolioName || "Not assigned",
        },
      }),
    })
      .then(async (response) => {
        if (response.ok) return;
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        console.warn("Status email dispatch failed:", payload.error || response.statusText);
      })
      .catch(() => undefined);
  };

  const persistNotifications = (next: UserNotification[]) => {
    setNotifications(next);
    localStorage.setItem("tidingz_notifications", JSON.stringify(next));
  };

  const addNotification = (notification: UserNotification) => {
    persistNotifications([notification, ...notifications]);
  };

  const updateUserRegistrationAssignment = (
    registrationId: string | undefined,
    patch: Partial<Registration>
  ) => {
    if (!registrationId) return;
    const storedUser = localStorage.getItem("tidingz_user");
    if (!storedUser) return;
    try {
      const parsed = JSON.parse(storedUser) as User;
      const updatedUser = {
        ...parsed,
        registeredConferences: (parsed.registeredConferences || []).map((registration) =>
          registration.id === registrationId ? { ...registration, ...patch } : registration
        ),
      };
      localStorage.setItem("tidingz_user", JSON.stringify(updatedUser));
      if (user && user.email === updatedUser.email) {
        setUser(updatedUser);
      }
    } catch {
      // no-op on malformed storage
    }
  };

  const addOrganizerConference: AuthContextType["addOrganizerConference"] = (payload) => {
    const current = organizerConferences;
    const next: OrganizerConference[] = [
      {
        ...payload,
        id: `org-${Date.now()}`,
        ownerUserId: user?.id,
        ownerEmail: user?.email,
        status: "Draft",
        applicants: [],
        announcements: [],
        statusEmailTemplates: normalizeStatusEmailTemplates(payload.statusEmailTemplates, payload.title),
      },
      ...current,
    ];
    persistOrganizerConferences(next);
  };

  const removeOrganizerConference: AuthContextType["removeOrganizerConference"] = (conferenceId) => {
    const current = organizerConferences;
    const next = current.filter((conference) => conference.id !== conferenceId);
    persistOrganizerConferences(next);
  };

  const updateOrganizerConferenceStatus: AuthContextType["updateOrganizerConferenceStatus"] = (conferenceId, status) => {
    const current = organizerConferences;
    const next = current.map((conference) =>
      conference.id === conferenceId ? { ...conference, status } : conference
    );
    persistOrganizerConferences(next);
  };

  const updateOrganizerConferenceConfig: AuthContextType["updateOrganizerConferenceConfig"] = (
    conferenceId,
    patch
  ) => {
    const current = organizerConferences;
    const next = current.map((conference) =>
      conference.id === conferenceId
        ? {
            ...conference,
            ...patch,
            socialLinks: {
              ...(conference.socialLinks || {}),
              ...(patch.socialLinks || {}),
            },
          }
        : conference
    );
    persistOrganizerConferences(next);
  };

  const updateOrganizerCommitteeConfig: AuthContextType["updateOrganizerCommitteeConfig"] = (
    conferenceId,
    committeeId,
    patch
  ) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        committees: conference.committees.map((committee) =>
          committee.id === committeeId ? { ...committee, ...patch } : committee
        ),
      };
    });
    persistOrganizerConferences(next);
  };

  const addOrganizerCommittee: AuthContextType["addOrganizerCommittee"] = (conferenceId, committee) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      const nextCommittee: OrganizerCommittee = {
        ...committee,
        id: `cm-${Date.now()}`,
        allottedCount: 0,
        type: getCommitteeTypeLabel(committee),
        memberMode:
          committee.memberMode || (committee.committeeType === "UN" ? "UN_COUNTRY" : "CUSTOM_MEMBER"),
        description: committee.description || undefined,
        logoImageUrl: committee.logoImageUrl || undefined,
        chairs: committee.chairs ?? [],
      };
      return {
        ...conference,
        committees: [...conference.committees, nextCommittee],
      };
    });
    persistOrganizerConferences(next);
  };

  const removeOrganizerCommittee: AuthContextType["removeOrganizerCommittee"] = (conferenceId, committeeId) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        committees: conference.committees.filter((committee) => committee.id !== committeeId),
      };
    });
    persistOrganizerConferences(next);
  };

  const updateRegistrationCategoryConfig: AuthContextType["updateRegistrationCategoryConfig"] = (
    conferenceId,
    categoryId,
    patch
  ) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        registrationCategories: conference.registrationCategories.map((category) =>
          category.id === categoryId ? { ...category, ...patch } : category
        ),
      };
    });
    persistOrganizerConferences(next);
  };

  const addConferenceReview: AuthContextType["addConferenceReview"] = (conferenceId, payload) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      const review: ConferenceReview = {
        id: `review-${Date.now()}`,
        conferenceId,
        ...payload,
        status: "approved",
        featured: false,
        createdAt: new Date().toISOString(),
      };
      return {
        ...conference,
        reviews: [review, ...(conference.reviews || [])],
      };
    });
    persistOrganizerConferences(next);
  };

  const moderateConferenceReview: AuthContextType["moderateConferenceReview"] = (
    conferenceId,
    reviewId,
    patch
  ) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        reviews: (conference.reviews || []).map((review) =>
          review.id === reviewId ? { ...review, ...patch } : review
        ),
      };
    });
    persistOrganizerConferences(next);
  };

  const removeConferenceReview: AuthContextType["removeConferenceReview"] = (conferenceId, reviewId, userId) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        reviews: (conference.reviews || []).filter((review) => !(review.id === reviewId && review.userId === userId)),
      };
    });
    persistOrganizerConferences(next);
  };

  const addConferenceAward: AuthContextType["addConferenceAward"] = (conferenceId, award) => {
    const createDelegateAwardEntry = (conferenceTitle: string) => {
      const awardTitle = award.prizeTitle?.trim() || award.category.trim() || "Conference Award";
      const year = new Date().getFullYear();
      return {
        id: `mun-award-${Date.now()}`,
        title: awardTitle,
        conferenceName: conferenceTitle,
        year,
        category: award.category || undefined,
        committee: undefined,
        logoUrl: award.sponsorLogoUrl || undefined,
      };
    };
    const syncAwardIntoProfile = (conferenceTitle: string) => {
      const targetUserId = award.participantUserId?.trim();
      const targetUserEmail = award.participantUserEmail?.trim().toLowerCase();
      if (!targetUserId && !targetUserEmail) return;

      const matchesTarget = (candidate: { id?: string; email?: string }) =>
        (targetUserId && candidate.id === targetUserId) ||
        (targetUserEmail && candidate.email?.toLowerCase() === targetUserEmail);

      const appendAward = (existingRaw: unknown) => {
        const existing = normalizeUser(existingRaw);
        if (!existing || !matchesTarget(existing)) return null;
        const nextAward = createDelegateAwardEntry(conferenceTitle);
        const nextAwards = [...(existing.munAwards || []), nextAward];
        const nextSummary =
          `${existing.munAwardsSummary || ""}${existing.munAwardsSummary ? "\n" : ""}` +
          `${nextAward.title} - ${conferenceTitle}`;
        return normalizeUser({
          ...existing,
          munAwards: nextAwards,
          munAwardsSummary: nextSummary,
        });
      };

      if (user) {
        const nextCurrent = appendAward(user);
        if (nextCurrent) {
          setUser(nextCurrent);
          localStorage.setItem("tidingz_user", JSON.stringify(nextCurrent));
          return;
        }
      }

      const stored = localStorage.getItem("tidingz_user");
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored);
        const nextStored = appendAward(parsed);
        if (nextStored) {
          localStorage.setItem("tidingz_user", JSON.stringify(nextStored));
        }
      } catch {
        // ignore malformed storage
      }
    };

    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      const createdAward = {
        ...award,
        id: `award-${Date.now()}`,
      };
      syncAwardIntoProfile(conference.title);
      return {
        ...conference,
        awards: [
          ...(conference.awards || []),
          createdAward,
        ],
      };
    });
    persistOrganizerConferences(next);
  };

  const removeConferenceAward: AuthContextType["removeConferenceAward"] = (conferenceId, awardId) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        awards: (conference.awards || []).filter((award) => award.id !== awardId),
      };
    });
    persistOrganizerConferences(next);
  };

  const updateApplicantStatus: AuthContextType["updateApplicantStatus"] = (conferenceId, applicantId, status) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        applicants: conference.applicants.map((applicant) =>
          applicant.id === applicantId ? { ...applicant, status } : applicant
        ),
      };
    });
    persistOrganizerConferences(next);
    const targetConference = next.find((conference) => conference.id === conferenceId);
    const targetApplicant = targetConference?.applicants.find((applicant) => applicant.id === applicantId);
    if (targetConference && targetApplicant) {
      triggerStatusEmail({ conference: targetConference, applicant: targetApplicant, status });
    }
  };

  const toggleApplicantPayment: AuthContextType["toggleApplicantPayment"] = (conferenceId, applicantId) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        applicants: conference.applicants.map((applicant) =>
          applicant.id === applicantId ? { ...applicant, paid: !applicant.paid } : applicant
        ),
      };
    });
    persistOrganizerConferences(next);
  };

  const addAnnouncement: AuthContextType["addAnnouncement"] = (conferenceId, title, message) => {
    const current = organizerConferences;
    const announcement: OrganizerAnnouncement = {
      id: `an-${Date.now()}`,
      title,
      message,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        announcements: [announcement, ...conference.announcements],
      };
    });
    persistOrganizerConferences(next);
  };

  const assignApplicant: AuthContextType["assignApplicant"] = ({
    conferenceId,
    applicantId,
    committeeId,
    portfolioId,
    allowOverride = false,
  }) => {
    const current = organizerConferences;
    const conference = current.find((entry) => entry.id === conferenceId);
    if (!conference) return { ok: false, message: "Conference not found." };

    const applicant = conference.applicants.find((entry) => entry.id === applicantId);
    if (!applicant) return { ok: false, message: "Applicant not found." };

    const committee = conference.committees.find((entry) => entry.id === committeeId);
    if (!committee) return { ok: false, message: "Committee not found." };

    const filledSeats = conference.applicants.filter(
      (entry) => entry.status === "Allotted" && entry.assignedCommitteeId === committeeId
    ).length;
    if (filledSeats >= committee.seatCount && !allowOverride) {
      return { ok: false, message: "Committee is full. Enable override to continue." };
    }

    let portfolioName: string | undefined;
    if (portfolioId) {
      const portfolio = (committee.portfolios ?? []).find((entry) => entry.id === portfolioId);
      if (!portfolio) return { ok: false, message: "Portfolio not found." };
      if (
        portfolio.assignedApplicantIds.length >= portfolio.seatCount &&
        !portfolio.assignedApplicantIds.includes(applicantId)
      ) {
        return { ok: false, message: "Portfolio is full." };
      }
      portfolioName = portfolio.name;
    }

    const next: OrganizerConference[] = current.map((entry) => {
      if (entry.id !== conferenceId) return entry;

      return {
        ...entry,
        committees: entry.committees.map((item) => {
          let assignedApplicantIds = (item.portfolios ?? []).map((portfolio) => ({
            ...portfolio,
            assignedApplicantIds: portfolio.assignedApplicantIds.filter((id) => id !== applicantId),
          }));

          if (item.id === committeeId && portfolioId) {
            assignedApplicantIds = assignedApplicantIds.map((portfolio) =>
              portfolio.id === portfolioId
                ? { ...portfolio, assignedApplicantIds: [...portfolio.assignedApplicantIds, applicantId] }
                : portfolio
            );
          }

          return { ...item, portfolios: assignedApplicantIds };
        }),
        applicants: entry.applicants.map((item) => {
          if (item.id !== applicantId) return item;
          const updatedApplicant: OrganizerApplicant = {
            ...item,
            status: "Allotted",
            assignmentStatus: "Allotted",
            assignedCommitteeId: committee.id,
            assignedCommitteeName: committee.name,
            assignedPortfolioId: portfolioId,
            assignedPortfolioName: portfolioName,
            assignedAt: new Date().toISOString(),
            overrideUsed: allowOverride,
            assignmentHistory: [
              ...(item.assignmentHistory ?? []),
              {
                id: `asg-${Date.now()}`,
                action: item.assignedCommitteeId ? "moved" : "allotted",
                committeeId: committee.id,
                committeeName: committee.name,
                portfolioId,
                portfolioName,
                overrideUsed: allowOverride,
                createdAt: new Date().toISOString(),
              },
            ],
          };
          return updatedApplicant;
        }),
      };
    });

    persistOrganizerConferences(next);
    updateUserRegistrationAssignment(applicant.registrationId, {
      status: "Confirmed",
      organizerStatus: "Allotted",
      assignedCommitteeId: committee.id,
      assignedCommitteeName: committee.name,
      assignedPortfolioId: portfolioId,
      assignedPortfolioName: portfolioName,
      assignedAt: new Date().toISOString(),
      overrideUsed: allowOverride,
    });

    addNotification({
      id: `ntf-${Date.now()}`,
      conferenceId,
      userId: applicant.userId,
      userEmail: applicant.userEmail,
      title: "Committee Allocation Confirmed",
      message: `You have been allotted to ${committee.name}${portfolioName ? ` (${portfolioName})` : ""}.`,
      type: "assignment",
      createdAt: new Date().toISOString(),
      read: false,
    });

    const updatedConference = next.find((entry) => entry.id === conferenceId);
    const updatedApplicant = updatedConference?.applicants.find((entry) => entry.id === applicantId);
    if (updatedConference && updatedApplicant) {
      triggerStatusEmail({
        conference: updatedConference,
        applicant: updatedApplicant,
        status: "Allotted",
        assignedCommitteeName: committee.name,
        assignedPortfolioName: portfolioName,
      });
    }

    return { ok: true, message: "Applicant allotted successfully." };
  };

  const moveApplicant: AuthContextType["moveApplicant"] = (payload) => {
    return assignApplicant(payload);
  };

  const unassignApplicant: AuthContextType["unassignApplicant"] = (conferenceId, applicantId) => {
    const current = organizerConferences;
    const conference = current.find((entry) => entry.id === conferenceId);
    if (!conference) return { ok: false, message: "Conference not found." };
    const applicant = conference.applicants.find((entry) => entry.id === applicantId);
    if (!applicant) return { ok: false, message: "Applicant not found." };

    const next: OrganizerConference[] = current.map((entry) => {
      if (entry.id !== conferenceId) return entry;
      return {
        ...entry,
        committees: entry.committees.map((committee) => ({
          ...committee,
          portfolios: (committee.portfolios ?? []).map((portfolio) => ({
            ...portfolio,
            assignedApplicantIds: portfolio.assignedApplicantIds.filter((id) => id !== applicantId),
          })),
        })),
        applicants: entry.applicants.map((item) => {
          if (item.id !== applicantId) return item;
          const updatedApplicant: OrganizerApplicant = {
            ...item,
            status: "Pending",
            assignmentStatus: "Pending",
            assignedCommitteeId: undefined,
            assignedCommitteeName: undefined,
            assignedPortfolioId: undefined,
            assignedPortfolioName: undefined,
            assignedAt: undefined,
            assignmentHistory: [
              ...(item.assignmentHistory ?? []),
              { id: `asg-${Date.now()}`, action: "unassigned", createdAt: new Date().toISOString() },
            ],
          };
          return updatedApplicant;
        }),
      };
    });
    persistOrganizerConferences(next);
    updateUserRegistrationAssignment(applicant.registrationId, {
      organizerStatus: "Pending",
      assignedCommitteeId: undefined,
      assignedCommitteeName: undefined,
      assignedPortfolioId: undefined,
      assignedPortfolioName: undefined,
      assignedAt: undefined,
    });
    return { ok: true, message: "Applicant unassigned." };
  };

  const waitlistApplicant: AuthContextType["waitlistApplicant"] = (conferenceId, applicantId) => {
    const current = organizerConferences;
    const conference = current.find((entry) => entry.id === conferenceId);
    if (!conference) return { ok: false, message: "Conference not found." };
    const applicant = conference.applicants.find((entry) => entry.id === applicantId);
    if (!applicant) return { ok: false, message: "Applicant not found." };

    const clearAssignment = unassignApplicant(conferenceId, applicantId);
    if (!clearAssignment.ok) return clearAssignment;

    const refreshed = organizerConferences;
    const next: OrganizerConference[] = refreshed.map((entry) => {
      if (entry.id !== conferenceId) return entry;
      return {
        ...entry,
        applicants: entry.applicants.map((item) => {
          if (item.id !== applicantId) return item;
          const updatedApplicant: OrganizerApplicant = {
            ...item,
            status: "Waitlisted",
            assignmentStatus: "Waitlisted",
            assignmentHistory: [
              ...(item.assignmentHistory ?? []),
              { id: `asg-${Date.now()}`, action: "waitlisted", createdAt: new Date().toISOString() },
            ],
          };
          return updatedApplicant;
        }),
      };
    });
    persistOrganizerConferences(next);
    updateUserRegistrationAssignment(applicant.registrationId, {
      status: "Waitlisted",
      organizerStatus: "Waitlisted",
    });
    addNotification({
      id: `ntf-${Date.now()}`,
      conferenceId,
      userId: applicant.userId,
      userEmail: applicant.userEmail,
      title: "Application Waitlisted",
      message: `Your application for ${conference.title} has been moved to waitlist.`,
      type: "waitlist",
      createdAt: new Date().toISOString(),
      read: false,
    });
    const updatedConference = next.find((entry) => entry.id === conferenceId);
    const updatedApplicant = updatedConference?.applicants.find((entry) => entry.id === applicantId);
    if (updatedConference && updatedApplicant) {
      triggerStatusEmail({ conference: updatedConference, applicant: updatedApplicant, status: "Waitlisted" });
    }
    return { ok: true, message: "Applicant waitlisted." };
  };

  const inviteApplicant: AuthContextType["inviteApplicant"] = (conferenceId, applicantId) => {
    const current = organizerConferences;
    const conference = current.find((entry) => entry.id === conferenceId);
    if (!conference) return { ok: false, message: "Conference not found." };
    const applicant = conference.applicants.find((entry) => entry.id === applicantId);
    if (!applicant) return { ok: false, message: "Applicant not found." };

    const next: OrganizerConference[] = current.map((entry) => {
      if (entry.id !== conferenceId) return entry;
      return {
        ...entry,
        applicants: entry.applicants.map((item) =>
          item.id === applicantId
            ? {
                ...item,
                status: "Invited",
                assignmentStatus: "Invited",
                assignmentHistory: [
                  ...(item.assignmentHistory ?? []),
                  { id: `asg-${Date.now()}`, action: "invited", createdAt: new Date().toISOString() },
                ],
              }
            : item
        ),
      };
    });
    persistOrganizerConferences(next);
    updateUserRegistrationAssignment(applicant.registrationId, {
      organizerStatus: "Invited",
      status: "Pending",
    });
    addNotification({
      id: `ntf-${Date.now()}`,
      conferenceId,
      userId: applicant.userId,
      userEmail: applicant.userEmail,
      title: "Application Invited",
      message: `You are invited to proceed with ${conference.title}. Complete your steps to secure a seat.`,
      type: "status",
      createdAt: new Date().toISOString(),
      read: false,
    });
    const updatedConference = next.find((entry) => entry.id === conferenceId);
    const updatedApplicant = updatedConference?.applicants.find((entry) => entry.id === applicantId);
    if (updatedConference && updatedApplicant) {
      triggerStatusEmail({ conference: updatedConference, applicant: updatedApplicant, status: "Invited" });
    }
    return { ok: true, message: "Applicant marked as invited." };
  };

  const overrideSeatLimit: AuthContextType["overrideSeatLimit"] = (
    conferenceId,
    committeeId,
    seatCount
  ) => {
    const current = organizerConferences;
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        committees: conference.committees.map((committee) =>
          committee.id === committeeId ? { ...committee, seatCount } : committee
        ),
      };
    });
    persistOrganizerConferences(next);
  };

  const markNotificationRead: AuthContextType["markNotificationRead"] = (notificationId) => {
    const next = notifications.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification
    );
    persistNotifications(next);
  };

  const updateDelegateProfile: AuthContextType["updateDelegateProfile"] = (patch) => {
    if (!user) return;
    const normalized = normalizeUser({
      ...user,
      ...patch,
      munParticipations: patch.munParticipations ?? user.munParticipations ?? [],
      munAwards: patch.munAwards ?? user.munAwards ?? [],
    });
    if (!normalized) return;
    setUser(normalized);
    localStorage.setItem("tidingz_user", JSON.stringify(normalized));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        authReady,
        organizerConferences,
        login,
        logout,
        addRegistration,
        addOrganizerConference,
        removeOrganizerConference,
        updateOrganizerConferenceStatus,
        updateOrganizerConferenceConfig,
        updateOrganizerCommitteeConfig,
        addOrganizerCommittee,
        removeOrganizerCommittee,
        updateRegistrationCategoryConfig,
        addConferenceReview,
        moderateConferenceReview,
        removeConferenceReview,
        addConferenceAward,
        removeConferenceAward,
        updateApplicantStatus,
        toggleApplicantPayment,
        addAnnouncement,
        assignApplicant,
        moveApplicant,
        unassignApplicant,
        waitlistApplicant,
        inviteApplicant,
        overrideSeatLimit,
        notifications,
        markNotificationRead,
        updateDelegateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
