import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PLATFORM_FEE_RATE, netAfterPlatformFee } from "@/lib/platform-finance";
import { moneyNumber } from "@/lib/server/decimal-money";
import { getRequestActor, isSuperAdmin } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";

const IST_TIMEZONE = "Asia/Kolkata";

function getTodayIstDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TIMEZONE }).format(new Date());
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getIstDayBounds(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get("date")?.trim() || getTodayIstDateString();
  if (!isValidDateString(dateRaw)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  const { start, end } = getIstDayBounds(dateRaw);

  const registrations = await prisma.registration.findMany({
    where: {
      deletedAt: null,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    select: {
      eventId: true,
      amount: true,
      paid: true,
      event: {
        select: {
          title: true,
          owner: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  const grouped = new Map<
    string,
    {
      eventId: string;
      eventTitle: string;
      organizerEmail: string | null;
      registrationCount: number;
      paidCount: number;
      amountCollected: number;
    }
  >();

  for (const registration of registrations) {
    const existing = grouped.get(registration.eventId) ?? {
      eventId: registration.eventId,
      eventTitle: registration.event.title,
      organizerEmail: registration.event.owner?.email ?? null,
      registrationCount: 0,
      paidCount: 0,
      amountCollected: 0,
    };

    existing.registrationCount += 1;
    if (registration.paid) {
      existing.paidCount += 1;
      existing.amountCollected += moneyNumber(registration.amount);
    }

    grouped.set(registration.eventId, existing);
  }

  const rows = Array.from(grouped.values())
    .map((row) => {
      const platformCut = Math.max(0, Math.round(row.amountCollected * PLATFORM_FEE_RATE));
      return {
        ...row,
        amountCollected: Math.round(row.amountCollected),
        platformCut,
        organizerNet: netAfterPlatformFee(row.amountCollected),
      };
    })
    .sort((a, b) => b.registrationCount - a.registrationCount || a.eventTitle.localeCompare(b.eventTitle));

  const totals = rows.reduce(
    (acc, row) => ({
      registrationCount: acc.registrationCount + row.registrationCount,
      paidCount: acc.paidCount + row.paidCount,
      amountCollected: acc.amountCollected + row.amountCollected,
      platformCut: acc.platformCut + row.platformCut,
      organizerNet: acc.organizerNet + row.organizerNet,
    }),
    {
      registrationCount: 0,
      paidCount: 0,
      amountCollected: 0,
      platformCut: 0,
      organizerNet: 0,
    }
  );

  return NextResponse.json({
    date: dateRaw,
    rows,
    totals,
  });
}
