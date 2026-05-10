import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EventStatus } from "@/generated/prisma/enums";
import { getRequestActor, isSuperAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

const EVENT_STATUSES: EventStatus[] = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED", "CANCELLED"];

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status")?.trim();
  const search = searchParams.get("search")?.trim() ?? "";

  const status: EventStatus | undefined =
    statusRaw && EVENT_STATUSES.includes(statusRaw as EventStatus)
      ? (statusRaw as EventStatus)
      : undefined;

  const events = await prisma.event.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            title: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          email: true,
          name: true,
        },
      },
      _count: {
        select: { registrations: true },
      },
    },
  });

  return NextResponse.json({
    events: events.map((e) => ({
      ...e,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
  });
}
