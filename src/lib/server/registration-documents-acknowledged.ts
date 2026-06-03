import { prisma } from "@/lib/server/prisma";

const REQUIRED_ACK_CATEGORIES = new Set(["background-guide", "rules"]);

export async function registrationDocumentsAcknowledged(params: {
  registrationId: string;
  committeeName: string | null;
  eventId: string;
}): Promise<{ acknowledged: boolean; pendingCount: number }> {
  if (!params.committeeName?.trim()) {
    return { acknowledged: true, pendingCount: 0 };
  }

  const committee = await prisma.committeeConfig.findFirst({
    where: {
      name: params.committeeName,
      organizerConfig: { eventId: params.eventId },
    },
    include: { documents: true },
  });

  if (!committee) {
    return { acknowledged: true, pendingCount: 0 };
  }

  const requiredDocs = committee.documents.filter((doc) =>
    REQUIRED_ACK_CATEGORIES.has(doc.category)
  );
  if (requiredDocs.length === 0) {
    return { acknowledged: true, pendingCount: 0 };
  }

  const acknowledgments = await prisma.documentAcknowledgment.findMany({
    where: {
      registrationId: params.registrationId,
      documentId: { in: requiredDocs.map((doc) => doc.id) },
    },
    select: { documentId: true },
  });

  const ackedIds = new Set(acknowledgments.map((entry) => entry.documentId));
  const pendingCount = requiredDocs.filter((doc) => !ackedIds.has(doc.id)).length;
  return { acknowledged: pendingCount === 0, pendingCount };
}
