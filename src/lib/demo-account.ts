export const DEMO_EMAIL_DOMAIN = "@tidingz.demo";

export const DEMO_ACCOUNTS = {
  organizer: {
    email: "organizer1@tidingz.demo",
    password: "TidingzDemo1",
    label: "Organizer",
    redirect: "/organizers/dashboard",
  },
  delegate: {
    email: "delegate1@tidingz.demo",
    password: "TidingzDemo1",
    label: "Delegate",
    redirect: "/dashboard?tab=conferences",
  },
} as const;

export function isDemoAccount(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}
