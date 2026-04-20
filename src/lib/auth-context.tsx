"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  ConferenceReview,
  DelegateMunAward,
  DelegateMunParticipation,
  OrganizerAwardConfig,
  OrganizerCommittee,
  OrganizerCommitteeQuestion,
  OrganizerSocialLinks,
  User,
  Registration,
  OrganizerConference,
  OrganizerApplicant,
  OrganizerAnnouncement,
  UserNotification,
} from "./types";
import { MOCK_USER, MOCK_ORGANIZER_CONFERENCES } from "./data";

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
          type: committee.type ? String(committee.type) : undefined,
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
          portfolios,
        };
      })
    : [];

  const registrationCategories = Array.isArray(conference.registrationCategories)
    ? conference.registrationCategories
    : [
        {
          id: "cat-default",
          name: "Delegate Registration",
          description: "Default registration category migrated from legacy event format.",
          basePrice: legacyFee,
          requiresCommitteeSelection: true,
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
              ? (applicant.responses as Record<string, string | number | boolean>)
              : {},
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

  return {
    id: String(conference.id ?? `org-${Date.now()}`),
    title: String(conference.title ?? "Untitled Conference"),
    city: String(conference.city ?? ""),
    country: String(conference.country ?? ""),
    organizerName: String(conference.organizerName ?? ""),
    level: (conference.level as OrganizerConference["level"]) ?? "Open",
    capacity: Number(conference.capacity ?? 0),
    startDate: String(conference.startDate ?? ""),
    endDate: String(conference.endDate ?? ""),
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
    socialLinks:
      typeof conference.socialLinks === "object" && conference.socialLinks !== null
        ? (conference.socialLinks as OrganizerSocialLinks)
        : undefined,
    brandPrimaryColor:
      conference.brandPrimaryColor === undefined ? undefined : String(conference.brandPrimaryColor),
    brandSecondaryColor:
      conference.brandSecondaryColor === undefined ? undefined : String(conference.brandSecondaryColor),
    partnerConferenceIds: Array.isArray(conference.partnerConferenceIds)
      ? conference.partnerConferenceIds.map((entry) => String(entry))
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
        };
      })
    : [];

  return {
    id: String(value.id ?? ""),
    name: String(value.name ?? ""),
    email: String(value.email ?? ""),
    avatar: String(value.avatar ?? "U"),
    school: String(value.school ?? ""),
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

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  organizerConferences: OrganizerConference[];
  login: (email: string, name?: string) => void;
  logout: () => void;
  addRegistration: (reg: Registration) => void;
  addOrganizerConference: (
    payload: Omit<OrganizerConference, "id" | "status" | "applicants" | "announcements">
  ) => void;
  updateOrganizerConferenceStatus: (conferenceId: string, status: OrganizerConference["status"]) => void;
  updateOrganizerConferenceConfig: (
    conferenceId: string,
    patch: Partial<
      Pick<
        OrganizerConference,
        | "title"
        | "city"
        | "country"
        | "organizerName"
        | "venue"
        | "description"
        | "logoImageUrl"
        | "bannerImageUrl"
        | "bannerSourceType"
        | "socialLinks"
        | "brandPrimaryColor"
        | "brandSecondaryColor"
        | "partnerConferenceIds"
        | "previousEditions"
        | "delegationInviteCode"
        | "organizerTeam"
        | "awards"
        | "reviews"
      >
    >
  ) => void;
  updateOrganizerCommitteeConfig: (
    conferenceId: string,
    committeeId: string,
    patch: Partial<OrganizerCommittee>
  ) => void;
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
    school?: string;
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
  organizerConferences: [],
  login: () => {},
  logout: () => {},
  addRegistration: () => {},
  addOrganizerConference: () => {},
  updateOrganizerConferenceStatus: () => {},
  updateOrganizerConferenceConfig: () => {},
  updateOrganizerCommitteeConfig: () => {},
  updateRegistrationCategoryConfig: () => {},
  addConferenceReview: () => {},
  moderateConferenceReview: () => {},
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
    const storedOrganizerConferences = localStorage.getItem("tidingz_organizer_conferences");
    if (!storedOrganizerConferences) {
      const hasStoredUser = !!localStorage.getItem("tidingz_user");
      if (hasStoredUser) {
        localStorage.setItem("tidingz_organizer_conferences", JSON.stringify(MOCK_ORGANIZER_CONFERENCES));
        return MOCK_ORGANIZER_CONFERENCES.map(recomputeCommitteeAllotments);
      }
      return [];
    }
    try {
      const parsed = JSON.parse(storedOrganizerConferences);
      if (!Array.isArray(parsed)) return [];
      const normalized = parsed
        .map((entry) => normalizeOrganizerConference(entry))
        .filter((entry): entry is OrganizerConference => !!entry);
      localStorage.setItem("tidingz_organizer_conferences", JSON.stringify(normalized));
      return normalized.map(recomputeCommitteeAllotments);
    } catch {
      localStorage.removeItem("tidingz_organizer_conferences");
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

  const login = (email: string, name?: string) => {
    const loggedInUser = normalizeUser({
      ...MOCK_USER,
      email,
      name: name || email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      avatar: (name || email)[0].toUpperCase(),
    });
    if (!loggedInUser) return;
    setUser(loggedInUser);
    localStorage.setItem("tidingz_user", JSON.stringify(loggedInUser));
    if (organizerConferences.length === 0) {
      persistOrganizerConferences(MOCK_ORGANIZER_CONFERENCES.map(recomputeCommitteeAllotments));
    }
  };

  const logout = () => {
    setUser(null);
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

    const current = ensureOrganizerSeed(organizerConferences);
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
    setOrganizerConferences(normalized);
    localStorage.setItem("tidingz_organizer_conferences", JSON.stringify(normalized));
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

  const ensureOrganizerSeed = (current: OrganizerConference[]) => {
    if (current.length > 0) return current;
    return MOCK_ORGANIZER_CONFERENCES;
  };

  const addOrganizerConference: AuthContextType["addOrganizerConference"] = (payload) => {
    const current = ensureOrganizerSeed(organizerConferences);
    const next: OrganizerConference[] = [
      {
        ...payload,
        id: `org-${Date.now()}`,
        status: "Review",
        applicants: [],
        announcements: [],
      },
      ...current,
    ];
    persistOrganizerConferences(next);
  };

  const updateOrganizerConferenceStatus: AuthContextType["updateOrganizerConferenceStatus"] = (conferenceId, status) => {
    const current = ensureOrganizerSeed(organizerConferences);
    const next = current.map((conference) =>
      conference.id === conferenceId ? { ...conference, status } : conference
    );
    persistOrganizerConferences(next);
  };

  const updateOrganizerConferenceConfig: AuthContextType["updateOrganizerConferenceConfig"] = (
    conferenceId,
    patch
  ) => {
    const current = ensureOrganizerSeed(organizerConferences);
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
    const current = ensureOrganizerSeed(organizerConferences);
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

  const updateRegistrationCategoryConfig: AuthContextType["updateRegistrationCategoryConfig"] = (
    conferenceId,
    categoryId,
    patch
  ) => {
    const current = ensureOrganizerSeed(organizerConferences);
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
    const current = ensureOrganizerSeed(organizerConferences);
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      const review: ConferenceReview = {
        id: `review-${Date.now()}`,
        conferenceId,
        ...payload,
        status: "pending",
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
    const current = ensureOrganizerSeed(organizerConferences);
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

  const addConferenceAward: AuthContextType["addConferenceAward"] = (conferenceId, award) => {
    const current = ensureOrganizerSeed(organizerConferences);
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        awards: [
          ...(conference.awards || []),
          {
            ...award,
            id: `award-${Date.now()}`,
          },
        ],
      };
    });
    persistOrganizerConferences(next);
  };

  const removeConferenceAward: AuthContextType["removeConferenceAward"] = (conferenceId, awardId) => {
    const current = ensureOrganizerSeed(organizerConferences);
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
    const current = ensureOrganizerSeed(organizerConferences);
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
  };

  const toggleApplicantPayment: AuthContextType["toggleApplicantPayment"] = (conferenceId, applicantId) => {
    const current = ensureOrganizerSeed(organizerConferences);
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
    const current = ensureOrganizerSeed(organizerConferences);
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
    const current = ensureOrganizerSeed(organizerConferences);
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

    return { ok: true, message: "Applicant allotted successfully." };
  };

  const moveApplicant: AuthContextType["moveApplicant"] = (payload) => {
    return assignApplicant(payload);
  };

  const unassignApplicant: AuthContextType["unassignApplicant"] = (conferenceId, applicantId) => {
    const current = ensureOrganizerSeed(organizerConferences);
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
    const current = ensureOrganizerSeed(organizerConferences);
    const conference = current.find((entry) => entry.id === conferenceId);
    if (!conference) return { ok: false, message: "Conference not found." };
    const applicant = conference.applicants.find((entry) => entry.id === applicantId);
    if (!applicant) return { ok: false, message: "Applicant not found." };

    const clearAssignment = unassignApplicant(conferenceId, applicantId);
    if (!clearAssignment.ok) return clearAssignment;

    const refreshed = ensureOrganizerSeed(
      JSON.parse(localStorage.getItem("tidingz_organizer_conferences") || "[]") as OrganizerConference[]
    );
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
    return { ok: true, message: "Applicant waitlisted." };
  };

  const inviteApplicant: AuthContextType["inviteApplicant"] = (conferenceId, applicantId) => {
    const current = ensureOrganizerSeed(organizerConferences);
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
    return { ok: true, message: "Applicant marked as invited." };
  };

  const overrideSeatLimit: AuthContextType["overrideSeatLimit"] = (
    conferenceId,
    committeeId,
    seatCount
  ) => {
    const current = ensureOrganizerSeed(organizerConferences);
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
        organizerConferences,
        login,
        logout,
        addRegistration,
        addOrganizerConference,
        updateOrganizerConferenceStatus,
        updateOrganizerConferenceConfig,
        updateOrganizerCommitteeConfig,
        updateRegistrationCategoryConfig,
        addConferenceReview,
        moderateConferenceReview,
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
