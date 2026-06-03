import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { NotificationType } from "@/generated/prisma/enums";
import {
  BroadcastFilter,
  BroadcastRecipientError,
  findBroadcastRecipients,
} from "@/lib/server/broadcast-email-recipients";
import { buildOrganizerStatusEmailHtml } from "@/lib/server/organizer-status-email-html";
import {
  getRequestActor,
  requireEventOrganizerAccess,
  requireOrganizer,
  resolveActorUserId,
} from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";

const HOURLY_EMAILS_PER_EVENT = 100;
const VALID_FILTERS: BroadcastFilter[] = [
  "all",
  "paid",
  "allotted",
  "committeeId",
  "categoryId",
  "delegationId",
];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const apiKey = env.resendApiKey();
  const fromEmail = env.resendFromEmail();
  if (!apiKey || !fromEmail) {
    return NextResponse.json(
      { error: "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL." },
      { status: 500 }
    );
  }

  const params = await context.params;
  const eventId = String(params.eventId || "").trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  if (!(await requireEventOrganizerAccess(actor, eventId))) {
    return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const filterRaw = String(body.filter || "all").trim() as BroadcastFilter;
    const filter = VALID_FILTERS.includes(filterRaw) ? filterRaw : "all";

    if (!title || !message) {
      return NextResponse.json({ error: "title and message are required." }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { title: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Conference not found." }, { status: 404 });
    }

    const recipients = await findBroadcastRecipients({
      eventId,
      filter,
      committeeId: typeof body.committeeId === "string" ? body.committeeId : undefined,
      categoryId: typeof body.categoryId === "string" ? body.categoryId : undefined,
      delegationId: typeof body.delegationId === "string" ? body.delegationId : undefined,
    });

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, notifications: 0, skipped: 0 });
    }

    const resend = new Resend(apiKey);
    let sent = 0;
    let notifications = 0;
    let skipped = 0;

    for (const recipient of recipients) {
      const to = recipient.user.email.trim().toLowerCase();
      if (!to) {
        skipped += 1;
        continue;
      }

      const okRate = await consumeRateLimitBucket({
        key: `broadcast-email:${eventId}`,
        windowMs: 60 * 60 * 1000,
        limit: HOURLY_EMAILS_PER_EVENT,
      });
      if (!okRate) {
        return NextResponse.json(
          {
            error: "Too many emails sent for this conference. Try again later.",
            sent,
            notifications,
            skipped,
          },
          { status: 429 }
        );
      }

      const delegateName = recipient.user.name?.trim() || to.split("@")[0] || "Delegate";

      await resend.emails.send({
        from: fromEmail,
        to,
        subject: title,
        text: message,
        html: buildOrganizerStatusEmailHtml({
          delegateName,
          conferenceTitle: event.title,
          statusLine: title,
          bodyText: message,
        }),
      });

      await prisma.notification.create({
        data: {
          userId: recipient.userId,
          eventId,
          registrationId: recipient.id,
          title,
          message,
          type: NotificationType.ANNOUNCEMENT,
        },
      });

      sent += 1;
      notifications += 1;
    }

    const actorUserId = await resolveActorUserId(actor);
    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          actorUserId,
          eventId,
          action: "broadcast_email",
          entity: "email",
          entityId: eventId,
          after: { filter, sent, title },
          ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        },
      });
    }

    return NextResponse.json({ ok: true, sent, notifications, skipped });
  } catch (error) {
    if (error instanceof BroadcastRecipientError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to send broadcast email." }, { status: 500 });
  }
}
