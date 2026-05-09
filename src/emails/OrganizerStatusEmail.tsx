/* eslint-disable @next/next/no-head-element -- email HTML template, not a Next.js page */
import * as React from "react";

type Props = {
  delegateName: string;
  conferenceTitle: string;
  statusLine: string;
  /** Plain-text body; avoid HTML from untrusted input without sanitizing server-side. */
  bodyText: string;
};

/**
 * Portable JSX for transactional mail — render with your provider (e.g. Resend HTML)
 * or adapt to `@react-email/components` when that pipeline is wired.
 */
export function OrganizerStatusEmail({
  delegateName,
  conferenceTitle,
  statusLine,
  bodyText,
}: Props) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{statusLine}</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", lineHeight: 1.5, color: "#111" }}>
        <p>Hi {delegateName},</p>
        <p>
          <strong>{conferenceTitle}</strong>
        </p>
        <p style={{ fontWeight: 600 }}>{statusLine}</p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            background: "#f4f4f5",
            padding: "12px 14px",
            borderRadius: "8px",
          }}
        >
          {bodyText}
        </pre>
        <p style={{ color: "#52525b", fontSize: "13px" }}>— Tidingz</p>
      </body>
    </html>
  );
}
