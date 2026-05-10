-- Hot-path lookups: registrations by event, by user, and filtered listings (event + soft-delete)
CREATE INDEX "Registration_eventId_idx" ON "Registration"("eventId");
CREATE INDEX "Registration_userId_idx" ON "Registration"("userId");
CREATE INDEX "Registration_eventId_deletedAt_idx" ON "Registration"("eventId", "deletedAt");
