import { z } from "zod";

export const contactBodySchema = z.object({
  email: z.string().trim().email("Valid email is required."),
  message: z.string().trim().min(10, "Message must be at least 10 characters."),
});
