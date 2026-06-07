import type { Registration as PrismaRegistration, User as PrismaUser } from "@/generated/prisma/client";
import type { Registration, User } from "@/lib/types";
import { RegistrationStatus } from "@/generated/prisma/enums";
import { moneyNumber } from "@/lib/server/decimal-money";
import { prismaUserRoleToSession } from "@/lib/server/user-role";

function mapRegistrationStatusToOrganizer(
  s: RegistrationStatus
): NonNullable<Registration["organizerStatus"]> {
  switch (s) {
    case RegistrationStatus.ALLOTTED:
      return "Allotted";
    case RegistrationStatus.WAITLISTED:
      return "Waitlisted";
    case RegistrationStatus.REJECTED:
      return "Rejected";
    default:
      return "Pending";
  }
}

function mapRegistrationToClient(
  reg: PrismaRegistration & {
    event: { title: string };
    delegation?: { id: string; schoolName: string; inviteToken: string } | null;
  }
): Registration {
  const org = mapRegistrationStatusToOrganizer(reg.status);
  const isAllotted = reg.status === RegistrationStatus.ALLOTTED;
  const status: Registration["status"] =
    reg.status === RegistrationStatus.ALLOTTED
      ? "Confirmed"
      : reg.status === RegistrationStatus.WAITLISTED
        ? "Waitlisted"
        : "Pending";

  return {
    id: reg.id,
    conferenceId: reg.eventId,
    conferenceTitle: reg.event.title,
    categoryId: "",
    categoryName: reg.categoryName,
    committeeName: reg.committeeName ?? undefined,
    portfolioPreferencesByCommittee: undefined,
    assignedCommitteeName: isAllotted ? reg.committeeName ?? undefined : undefined,
    assignedPortfolioName: isAllotted ? reg.portfolioName ?? undefined : undefined,
    assignedAt: reg.allottedAt?.toISOString(),
    formAnswers: {},
    status,
    registeredAt: reg.createdAt.toISOString(),
    paid: reg.paid,
    amount: moneyNumber(reg.amount),
    userId: reg.userId,
    organizerStatus: org,
    delegationId: reg.delegationId ?? undefined,
    isDelegationHead: reg.isDelegationHead || undefined,
    delegationSchoolName: reg.delegation?.schoolName,
    delegationInviteToken: reg.isDelegationHead ? reg.delegation?.inviteToken : undefined,
  };
}

export function prismaUserToClientUser(
  user: PrismaUser & {
    registrations?: Array<PrismaRegistration & { event: { title: string } }>;
  }
): User {
  const profile =
    user.delegateProfile && typeof user.delegateProfile === "object"
      ? (user.delegateProfile as Record<string, unknown>)
      : {};

  const readStr = (k: string) => (typeof profile[k] === "string" ? profile[k] : undefined);

  const role = prismaUserRoleToSession(user.role);
  const avatar =
    typeof profile.avatar === "string" && profile.avatar.trim()
      ? profile.avatar.trim()
      : user.name[0]?.toUpperCase() || "U";

  const registrations = (user.registrations || []).map(mapRegistrationToClient);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    role,
    avatar,
    profileImageUrl: readStr("profileImageUrl"),
    firstName: readStr("firstName"),
    lastName: readStr("lastName"),
    school: readStr("school") ?? "",
    college: readStr("college"),
    fieldOfStudy: readStr("fieldOfStudy"),
    profileHeadline: readStr("profileHeadline"),
    phone: readStr("phone"),
    city: readStr("city"),
    state: readStr("state"),
    postalCode: readStr("postalCode"),
    country: readStr("country") ?? "",
    munExperienceSummary: readStr("munExperienceSummary"),
    munAwardsSummary: readStr("munAwardsSummary"),
    munParticipations: Array.isArray(profile.munParticipations)
      ? (profile.munParticipations as User["munParticipations"])
      : [],
    munAwards: Array.isArray(profile.munAwards) ? (profile.munAwards as User["munAwards"]) : [],
    profileVisibility: profile.profileVisibility === "private" ? "private" : "public",
    socialMedia:
      typeof profile.socialMedia === "object" && profile.socialMedia !== null
        ? (profile.socialMedia as User["socialMedia"])
        : undefined,
    invoiceAddress:
      typeof profile.invoiceAddress === "object" && profile.invoiceAddress !== null
        ? (profile.invoiceAddress as User["invoiceAddress"])
        : undefined,
    registeredConferences: registrations,
    notifications: [],
  };
}
