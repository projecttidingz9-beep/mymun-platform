import type { User } from "@/lib/types";
import { prismaUserToClientUser } from "@/lib/server/map-db-user";
import { prisma } from "@/lib/server/prisma";

const clientUserInclude = {
  registrations: {
    where: { deletedAt: null },
    include: {
      event: { select: { title: true } },
      delegation: { select: { id: true, schoolName: true, inviteToken: true } },
    },
  },
} as const;

/** Load a user row and map to the client `User` shape (same as GET /api/user/me). */
export async function loadClientUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: clientUserInclude,
  });
  if (!user) return null;
  return prismaUserToClientUser(user);
}
