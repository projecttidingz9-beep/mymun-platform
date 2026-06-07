export type EmailTemplateContext = {
  applicantName?: string;
  conferenceTitle?: string;
  status?: string;
  assignedCommittee?: string;
  assignedPortfolio?: string;
};

export function renderEmailTemplate(template: string, context: EmailTemplateContext): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: keyof EmailTemplateContext) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export const EMAIL_TEMPLATE_PREVIEW_CONTEXT: EmailTemplateContext = {
  applicantName: "Alex Chen",
  conferenceTitle: "Sample Model UN 2026",
  status: "Allotted",
  assignedCommittee: "UNSC",
  assignedPortfolio: "France",
};
