import { z } from "zod";

export const newsletterBodySchema = z.object({
  email: z.string().trim().email("Valid email required."),
});
