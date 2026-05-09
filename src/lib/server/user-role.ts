import type { UserRole } from "@/generated/prisma/client";
import type { SessionRole } from "./session-token";

export function prismaUserRoleToSession(role: UserRole): SessionRole {
  if (role === "ADMIN") return "admin";
  if (role === "ORGANIZER") return "organizer";
  return "delegate";
}
