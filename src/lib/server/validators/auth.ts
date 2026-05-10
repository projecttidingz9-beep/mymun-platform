import { z } from "zod";

export const registerBodySchema = z.object({
  email: z.string().trim().email("Valid email is required."),
  password: z.string().min(1, "Password is required."),
  name: z.string().trim().min(1, "Full name is required.").max(200),
  role: z.enum(["delegate", "organizer"]).optional(),
});

export const loginBodySchema = z.object({
  email: z.string().trim().email("Valid email is required."),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email("Valid email is required."),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1, "Token is required."),
  newPassword: z.string().min(1, "New password is required."),
});
