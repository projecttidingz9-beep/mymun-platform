/**
 * One-shot migration helper: finds legacy `__preview_json__:` blobs in
 * OrganizerConferenceConfig.description and reports them.
 *
 * Extend this script to copy structured fields into relational tables
 * (CommitteeConfig, PricingPhaseConfig, ApplicationQuestion) before removing the blob.
 *
 * Run: `npx tsx prisma/scripts/migrate-config-blob.ts`
 */
import "dotenv/config";
import { prisma } from "../../src/lib/server/prisma";

const PREFIX = "__preview_json__:";

async function main() {
  const rows = await prisma.organizerConferenceConfig.findMany({
    select: { eventId: true, description: true },
  });
  let blobCount = 0;
  for (const row of rows) {
    if (!row.description?.startsWith(PREFIX)) continue;
    blobCount++;
    console.log("[legacy blob]", row.eventId, `(${row.description.length} chars)`);
  }
  console.log(`\nDone. ${blobCount} row(s) still use embedded preview JSON.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
