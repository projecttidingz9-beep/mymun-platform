/**
 * One-time production super-admin bootstrap (upsert User + ADMIN role + password).
 * Never commit BOOTSTRAP_ADMIN_PASSWORD.
 *
 * Usage (production DATABASE_URL / DIRECT_URL in .env.local):
 *   BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='...' npm run bootstrap:admin
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config();

function defaultName(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "Admin";
}

async function main() {
  const { prisma } = await import("../src/lib/server/prisma");
  const { hashPassword, validateNewPassword } = await import("../src/lib/server/password");

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "braveshravan@gmail.com")
    .trim()
    .toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const name = (process.env.BOOTSTRAP_ADMIN_NAME || defaultName(email)).trim();

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required (point at production Postgres).");
    process.exit(1);
  }

  if (!password) {
    console.error("BOOTSTRAP_ADMIN_PASSWORD is required (pass only in the shell, never commit).");
    process.exit(1);
  }

  const passwordError = validateNewPassword(password);
  if (passwordError) {
    console.error(passwordError);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: "ADMIN",
      passwordHash,
    },
    update: {
      name,
      role: "ADMIN",
      passwordHash,
      deletedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`Super-admin ready: ${user.email} (id=${user.id}, role=${user.role})`);
  console.log("Ensure Vercel ADMIN_EMAIL matches this email, then sign in at /admin after redeploy.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
