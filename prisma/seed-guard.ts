/**
 * Blocks destructive seed against production / remote databases unless explicitly opted in.
 */
export function assertDestructiveSeedAllowed(): void {
  if (process.env.VERCEL_ENV === "production") {
    console.error(
      "Refusing to seed: VERCEL_ENV=production. Seed wipes all users and events."
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "Refusing to seed: NODE_ENV=production. Seed wipes all users and events."
    );
    process.exit(1);
  }

  if (process.env.ALLOW_DESTRUCTIVE_SEED === "true") {
    return;
  }

  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  const isLocalDatabase =
    /localhost|127\.0\.0\.1/i.test(databaseUrl) ||
    databaseUrl.includes("_build_placeholder");

  if (!isLocalDatabase) {
    console.error(
      [
        "Refusing to seed: DATABASE_URL points at a remote database.",
        "npm run db:seed deletes ALL users and conferences.",
        "",
        "Use a local Postgres for dev/E2E, or opt in explicitly:",
        "  ALLOW_DESTRUCTIVE_SEED=true npm run db:seed",
      ].join("\n")
    );
    process.exit(1);
  }
}
