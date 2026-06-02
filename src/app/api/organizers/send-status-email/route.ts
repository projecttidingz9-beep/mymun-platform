import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { buildOrganizerStatusEmailHtml } from "@/lib/server/organizer-status-email-html";
import { prisma } from "@/lib/server/prisma";
import { env } from "@/lib/server/env";
import {
  getRequestActor,
  requireEventOrganizerAccess,
  requireOrganizer,
  resolveActorUserId,
} from "@/lib/server/auth";
import { consumeRateLimitBucket } from "@/lib/server/rate-limit-db";

type EmailRenderContext = {
  applicantName?: string;
  conferenceTitle?: string;
  status?: string;
  assignedCommittee?: string;
  assignedPortfolio?: string;
};

const renderTemplate = (template: string, context: EmailRenderContext) =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: keyof EmailRenderContext) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });

const HOURLY_EMAILS_PER_EVENT = 100;

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const eventId = String(body.eventId || "").trim();
    const to = String(body.to || "").trim().toLowerCase();
    const subjectTemplate = String(body.subjectTemplate || "");
    const bodyTemplate = String(body.bodyTemplate || "");
    const context = (body.context || {}) as EmailRenderContext;

    if (!eventId || !to || !subjectTemplate.trim() || !bodyTemplate.trim()) {
      return NextResponse.json(
        { error: "eventId, to, subjectTemplate, and bodyTemplate are required." },
        { status: 400 }
      );
    }

    if (!(await requireEventOrganizerAccess(actor, eventId))) {
      return NextResponse.json({ error: "You do not have access to this conference." }, { status: 403 });
    }

    const okRate = await consumeRateLimitBucket({
      key: `send-status-email:${eventId}`,
      windowMs: 60 * 60 * 1000,
      limit: HOURLY_EMAILS_PER_EVENT,
    });
    if (!okRate) {
      return NextResponse.json(
        { error: "Too many emails sent for this conference. Try again later." },
        { status: 429 }
      );
    }

    const delegate = await prisma.user.findFirst({
      where: {
        email: to,
        registrations: { some: { eventId } },
      },
      select: { id: true },
    });
    if (!delegate) {
      return NextResponse.json(
        { error: "You can only email addresses that belong to a delegate registered for this conference." },
        { status: 403 }
      );
    }

    const subject = renderTemplate(subjectTemplate, context).trim();
    const text = renderTemplate(bodyTemplate, context).trim();
    const delegateName =
      String(context.applicantName || "").trim() ||
      to.split("@")[0] ||
      "Delegate";
    const conferenceTitle = String(context.conferenceTitle || "Your conference").trim();
    const statusLine = String(context.status || "Application update").trim();

    if (!subject || !text) {
      return NextResponse.json(
        { error: "Rendered email subject/body cannot be empty." },
        { status: 400 }
      );
    }

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      text,
      html: buildOrganizerStatusEmailHtml({
        delegateName,
        conferenceTitle,
        statusLine,
        bodyText: text,
      }),
    });

    const actorUserId = await resolveActorUserId(actor);
    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          actorUserId,
          eventId,
          action: "send_status_email",
          entity: "email",
          entityId: result.data?.id || to,
          after: { to, templateKey: body.templateKey || null },
          ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      emailId: result.data?.id || null,
      templateKey: body.templateKey || null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send status email." }, { status: 500 });
  }
}
