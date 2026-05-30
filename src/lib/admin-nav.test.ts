import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  canAccessSuperDashboard,
  getSuperAdminAllowlistedEmail,
  SUPER_ADMIN_HREF,
  SUPER_ADMIN_LABEL,
} from "./admin-nav";

describe("admin-nav", () => {
  const prev = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADMIN_EMAIL = "braveshravan@gmail.com";
  });

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    } else {
      process.env.NEXT_PUBLIC_ADMIN_EMAIL = prev;
    }
  });

  it("exports super admin route constants", () => {
    expect(SUPER_ADMIN_HREF).toBe("/admin");
    expect(SUPER_ADMIN_LABEL).toBe("Super Dashboard");
  });

  it("reads allowlisted email from env", () => {
    expect(getSuperAdminAllowlistedEmail()).toBe("braveshravan@gmail.com");
  });

  it("canAccessSuperDashboard requires admin role and matching email", () => {
    expect(canAccessSuperDashboard("admin", "braveshravan@gmail.com")).toBe(true);
    expect(canAccessSuperDashboard("admin", "Braveshravan@Gmail.com")).toBe(true);
    expect(canAccessSuperDashboard("admin", "other@example.com")).toBe(false);
    expect(canAccessSuperDashboard("organizer", "braveshravan@gmail.com")).toBe(false);
    expect(canAccessSuperDashboard(undefined, undefined)).toBe(false);
  });
});
