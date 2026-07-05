import { z } from "zod";

const organizerStatusSchema = z.enum(["Pending", "Allotted", "Waitlisted", "Rejected"]);

export const registrationSyncBodySchema = z.object({
  registrationId: z.string().trim().min(1, "registrationId is required."),
  eventId: z.string().trim().min(1, "eventId is required."),
  eventTitle: z.string().trim().min(1, "eventTitle is required."),
  eventStartDateIso: z.string().trim().min(1, "eventStartDateIso is required."),
  eventEndDateIso: z.string().trim().min(1, "eventEndDateIso is required."),
  userEmail: z.string().trim().email("Valid userEmail is required."),
  userName: z.string().trim().min(1, "userName is required."),
  categoryName: z.string().trim().min(1, "categoryName is required."),
  committeeName: z.string().trim().optional(),
  portfolioName: z.union([z.string().trim(), z.null()]).optional(),
  amount: z.coerce.number().finite().min(0),
  paid: z.boolean(),
  organizerStatus: organizerStatusSchema.optional(),
});

export const organizerRegistrationPatchSchema = z
  .object({
    organizerStatus: organizerStatusSchema.optional(),
    status: organizerStatusSchema.optional(),
    committeeName: z.string().trim().max(200).optional(),
    portfolioName: z.string().trim().max(200).optional(),
    portfolioId: z.string().trim().max(120).optional(),
    allottedAt: z.string().trim().optional(),
    paid: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const organizerNotificationBodySchema = z.object({
  registrationId: z.string().trim().min(1, "registrationId is required."),
  title: z.string().trim().max(200).optional(),
  message: z.string().trim().max(4000).optional(),
  type: z.string().trim().max(80).optional(),
});

const optionalTrimmedString = z.string().trim().max(500).optional();

export const userMePatchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    profileImageUrl: optionalTrimmedString,
    firstName: optionalTrimmedString,
    lastName: optionalTrimmedString,
    school: optionalTrimmedString,
    college: optionalTrimmedString,
    fieldOfStudy: optionalTrimmedString,
    profileHeadline: optionalTrimmedString,
    phone: optionalTrimmedString,
    city: optionalTrimmedString,
    state: optionalTrimmedString,
    postalCode: optionalTrimmedString,
    country: optionalTrimmedString,
    munExperienceSummary: z.string().trim().max(8000).optional(),
    munAwardsSummary: z.string().trim().max(8000).optional(),
    munParticipations: z.unknown().optional(),
    munAwards: z.unknown().optional(),
    profileVisibility: z.enum(["public", "private"]).optional(),
    socialMedia: z.unknown().optional(),
    invoiceAddress: z.unknown().optional(),
    avatar: z.string().trim().max(8).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });
