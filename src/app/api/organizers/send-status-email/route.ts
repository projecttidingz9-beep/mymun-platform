import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getRequestActor, requireOrganizer } from "@/lib/server/auth";

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

const toSimpleHtml = (text: string) => {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;">${escaped}</div>`;
};

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!requireOrganizer(actor)) {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return NextResponse.json(
      { error: "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const to = String(body.to || "").trim();
    const subjectTemplate = String(body.subjectTemplate || "");
    const bodyTemplate = String(body.bodyTemplate || "");
    const context = (body.context || {}) as EmailRenderContext;

    if (!to || !subjectTemplate.trim() || !bodyTemplate.trim()) {
      return NextResponse.json(
        { error: "to, subjectTemplate, and bodyTemplate are required." },
        { status: 400 }
      );
    }

    const subject = renderTemplate(subjectTemplate, context).trim();
    const text = renderTemplate(bodyTemplate, context).trim();

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
      html: toSimpleHtml(text),
    });

    return NextResponse.json({
      ok: true,
      emailId: result.data?.id || null,
      templateKey: body.templateKey || null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send status email." }, { status: 500 });
  }
}
