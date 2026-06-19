import type { OrganizerApplicant, OrganizerConference } from "@/lib/types";

export type AssignApplicantParams = {
  conferenceId: string;
  applicantId: string;
  committeeId: string;
  portfolioId?: string;
};

export type AssignApplicantResult = {
  ok: boolean;
  message?: string;
  conference?: OrganizerConference;
  applicant?: OrganizerApplicant;
  committeeName?: string;
  portfolioName?: string;
};

export function allotApplicantOnConference(
  conferences: OrganizerConference[],
  params: AssignApplicantParams
): { next: OrganizerConference[]; result: AssignApplicantResult } {
  const { conferenceId, applicantId, committeeId, portfolioId } = params;
  const conference = conferences.find((entry) => entry.id === conferenceId);
  if (!conference) {
    return { next: conferences, result: { ok: false, message: "Conference not found." } };
  }

  const applicant = conference.applicants.find((entry) => entry.id === applicantId);
  if (!applicant) {
    return { next: conferences, result: { ok: false, message: "Applicant not found." } };
  }

  const committee = conference.committees.find((entry) => entry.id === committeeId);
  if (!committee) {
    return { next: conferences, result: { ok: false, message: "Committee not found." } };
  }

  const filledSeats = conference.applicants.filter(
    (entry) => entry.status === "Allotted" && entry.assignedCommitteeId === committeeId
  ).length;
  if (filledSeats >= committee.seatCount) {
    return { next: conferences, result: { ok: false, message: "Committee is full." } };
  }

  let portfolioName: string | undefined;
  if (portfolioId) {
    const portfolio = (committee.portfolios ?? []).find((entry) => entry.id === portfolioId);
    if (!portfolio) {
      return { next: conferences, result: { ok: false, message: "Portfolio not found." } };
    }
    if (
      portfolio.assignedApplicantIds.length >= portfolio.seatCount &&
      !portfolio.assignedApplicantIds.includes(applicantId)
    ) {
      return { next: conferences, result: { ok: false, message: "Portfolio is full." } };
    }
    portfolioName = portfolio.name;
  } else if ((committee.portfolios?.length ?? 0) > 0) {
    return {
      next: conferences,
      result: { ok: false, message: "Select a portfolio/country for this committee." },
    };
  }

  const next = conferences.map((entry) => {
    if (entry.id !== conferenceId) return entry;

    return {
      ...entry,
      committees: entry.committees.map((item) => {
        let portfolios = (item.portfolios ?? []).map((portfolio) => ({
          ...portfolio,
          assignedApplicantIds: portfolio.assignedApplicantIds.filter((id) => id !== applicantId),
        }));

        if (item.id === committeeId && portfolioId) {
          portfolios = portfolios.map((portfolio) =>
            portfolio.id === portfolioId
              ? { ...portfolio, assignedApplicantIds: [...portfolio.assignedApplicantIds, applicantId] }
              : portfolio
          );
        }

        return { ...item, portfolios };
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
          assignmentHistory: [
            ...(item.assignmentHistory ?? []),
            {
              id: `asg-${Date.now()}`,
              action: item.assignedCommitteeId ? "moved" : "allotted",
              committeeId: committee.id,
              committeeName: committee.name,
              portfolioId,
              portfolioName,
              createdAt: new Date().toISOString(),
            },
          ],
        };
        return updatedApplicant;
      }),
    };
  });

  const updatedConference = next.find((entry) => entry.id === conferenceId)!;
  const updatedApplicant = updatedConference.applicants.find((entry) => entry.id === applicantId)!;

  return {
    next,
    result: {
      ok: true,
      conference: updatedConference,
      applicant: updatedApplicant,
      committeeName: committee.name,
      portfolioName,
    },
  };
}
