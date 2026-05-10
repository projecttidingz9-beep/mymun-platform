-- Supabase / Postgres hardening (optional but recommended on Supabase):
-- 1) pgcrypto in `extensions` when that schema exists (typical Supabase layout).
-- 2) RLS enabled on public app tables — anon/authenticated have no policies, so PostgREST/Data API
--    cannot read/write these tables by accident. Prisma uses the DB owner role from your connection
--    string; table owners bypass RLS unless FORCE ROW LEVEL SECURITY is used (we do not enable FORCE).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
  END IF;
END $$;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventTeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventPartnership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Registration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentIntent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DelegatePass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Checkin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserNotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizerConferenceConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommitteeConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PricingPhaseConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConferenceAward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConferenceReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Delegation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DelegationMember" ENABLE ROW LEVEL SECURITY;
