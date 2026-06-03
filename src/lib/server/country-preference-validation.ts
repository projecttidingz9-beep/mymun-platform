import { prisma } from "@/lib/server/prisma";

export async function validateCountryPreferencesForCommittee(params: {
  eventId: string;
  committeeConfigId?: string;
  countryPreferences: string[];
}) {
  if (params.countryPreferences.length === 0) return;

  const committeeId = params.committeeConfigId?.trim();
  if (!committeeId) return;

  const portfolios = await prisma.portfolio.findMany({
    where: {
      committeeId,
      committee: { organizerConfig: { eventId: params.eventId } },
    },
    select: { name: true },
  });

  if (portfolios.length === 0) return;

  const allowed = new Set(portfolios.map((p) => p.name.toLowerCase()));
  for (const pref of params.countryPreferences) {
    if (!allowed.has(pref.trim().toLowerCase())) {
      throw new Error(`Country/party preference "${pref}" is not valid for the selected committee.`);
    }
  }
}
