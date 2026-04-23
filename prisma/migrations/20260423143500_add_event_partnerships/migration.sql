-- CreateTable
CREATE TABLE "EventPartnership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceEventId" TEXT NOT NULL,
    "targetEventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "respondedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventPartnership_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventPartnership_targetEventId_fkey" FOREIGN KEY ("targetEventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventPartnership_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventPartnership_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EventPartnership_source_target_key" ON "EventPartnership"("sourceEventId", "targetEventId");

-- CreateIndex
CREATE INDEX "EventPartnership_sourceEventId_idx" ON "EventPartnership"("sourceEventId");

-- CreateIndex
CREATE INDEX "EventPartnership_targetEventId_idx" ON "EventPartnership"("targetEventId");
