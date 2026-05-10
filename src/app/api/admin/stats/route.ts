import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestActor, isSuperAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    usersByRole,
    eventsByStatus,
    registrationsByStatus,
    signupsLast30Days,
    totalUsers,
    totalEvents,
    totalRegistrations,
    recentUsers,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.registration.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.user.count({
      where: {
        deletedAt: null,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.event.count({ where: { deletedAt: null } }),
    prisma.registration.count(),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    totals: {
      users: totalUsers,
      events: totalEvents,
      registrations: totalRegistrations,
      signupsLast30Days,
    },
    usersByRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all])) as Record<
      string,
      number
    >,
    eventsByStatus: Object.fromEntries(eventsByStatus.map((r) => [r.status, r._count._all])) as Record<
      string,
      number
    >,
    registrationsByStatus: Object.fromEntries(
      registrationsByStatus.map((r) => [r.status, r._count._all])
    ) as Record<string, number>,
    recentUsers: recentUsers.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
