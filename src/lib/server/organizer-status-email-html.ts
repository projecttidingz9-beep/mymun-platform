function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML body aligned with `src/emails/OrganizerStatusEmail.tsx`. */
export function buildOrganizerStatusEmailHtml(params: {
  delegateName: string;
  conferenceTitle: string;
  statusLine: string;
  bodyText: string;
}) {
  const { delegateName, conferenceTitle, statusLine, bodyText } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${escapeHtml(statusLine)}</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <p>Hi ${escapeHtml(delegateName)},</p>
  <p><strong>${escapeHtml(conferenceTitle)}</strong></p>
  <p style="font-weight:600">${escapeHtml(statusLine)}</p>
  <pre style="white-space:pre-wrap;font-family:inherit;background:#f4f4f5;padding:12px 14px;border-radius:8px">${escapeHtml(bodyText)}</pre>
  <p style="color:#52525b;font-size:13px">— Tidingz</p>
</body>
</html>`;
}
