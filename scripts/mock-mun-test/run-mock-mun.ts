#!/usr/bin/env npx tsx
/**
 * Full mock MUN QA simulation — organizer + 10 personas, all registration roles.
 *
 * Usage:
 *   npx tsx scripts/mock-mun-test/run-mock-mun.ts [baseUrl]
 *
 * Requires: DATABASE_URL in .env.local, dev server at baseUrl (default http://127.0.0.1:3000)
 */
import { randomUUID } from "node:crypto";
import {
  QA_CATEGORY,
  QA_COMMITTEE,
  QA_EVENT_ID,
  QA_EVENT_SLUG,
  QA_EVENT_TITLE,
  QA_PASSWORD,
  QA_PERSONAS,
  QA_PORTFOLIO,
} from "./constants";
import {
  assertStep,
  getBaseUrl,
  getBugLog,
  HttpSession,
  loadEnv,
  logBug,
  waitForHealth,
  writeBugReport,
} from "./lib";
import { setupMockMunConference } from "./setup-conference";
import { cleanupMockMun } from "./cleanup-mock-mun";

loadEnv();

const baseUrl = getBaseUrl();
const registrations: Record<string, string> = {};
let delegationInviteToken = "";
let aishaQrToken = "";

async function login(session: HttpSession, email: string, password = QA_PASSWORD) {
  const { res, json } = await session.request(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { ok: res.ok, res, json };
}

async function registerUser(
  session: HttpSession,
  email: string,
  name: string,
  role: "delegate" | "organizer"
) {
  const { res, json } = await session.request(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: QA_PASSWORD, name, role }),
  });
  return { res, json };
}

function registrationBody(params: {
  registrationId: string;
  categoryId: string;
  categoryName: string;
  fullName: string;
  school: string;
  phone: string;
  committeeConfigId?: string;
  committeePreferences?: string[];
  countryPreferences?: string[];
  portfolioPreferencesByCommittee?: Record<string, string[]>;
}) {
  return {
    registrationId: params.registrationId,
    eventId: QA_EVENT_ID,
    categoryId: params.categoryId,
    categoryName: params.categoryName,
    fullName: params.fullName,
    school: params.school,
    formAnswers: {
      fullName: params.fullName,
      school: params.school,
      phone: params.phone,
    },
    committeeConfigId: params.committeeConfigId,
    committeePreferences: params.committeePreferences,
    countryPreferences: params.countryPreferences,
    portfolioPreferencesByCommittee: params.portfolioPreferencesByCommittee,
  };
}

async function registerDelegate(
  session: HttpSession,
  key: string,
  body: ReturnType<typeof registrationBody>
) {
  const { res, json } = await session.request(`${baseUrl}/api/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const id =
      (json as { registration?: { registrationId?: string }; clientRegistration?: { id?: string } })
        .registration?.registrationId ||
      (json as { clientRegistration?: { id?: string } }).clientRegistration?.id ||
      body.registrationId;
    registrations[key] = id;
  }
  return { res, json };
}

async function organizerPatchRegistration(
  organizer: HttpSession,
  registrationId: string,
  data: Record<string, unknown>
) {
  return organizer.request(`${baseUrl}/api/organizers/registrations/${registrationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function main() {
  console.log(`\n=== Mock MUN QA Test Run ===`);
  console.log(`Base URL: ${baseUrl}\n`);

  let failures = 0;
  const track = (name: string, ok: boolean) => {
    if (!ok) failures += 1;
    return ok;
  };

  // Pre-clean any leftover QA data from a prior aborted run
  try {
    await cleanupMockMun();
    console.log("Pre-run cleanup OK (idempotent).\n");
  } catch (err) {
    console.warn("Pre-run cleanup skipped:", err instanceof Error ? err.message : err);
  }

  const healthy = await waitForHealth(baseUrl);
  if (!track("health", assertStep("health", healthy, healthy ? "API healthy" : "Dev server not reachable — start npm run dev"))) {
    process.exit(1);
  }

  // Setup conference + users via Prisma
  let setup: Awaited<ReturnType<typeof setupMockMunConference>> | undefined;
  try {
    setup = await setupMockMunConference();
    track("setup", assertStep("setup", true, `Conference ${setup.eventId} ready (PUBLISHED)`));
  } catch (err) {
    track(
      "setup",
      assertStep("setup", false, "Conference setup failed", {
        error: err instanceof Error ? err.message : String(err),
      })
    );
    logBug({
      severity: "critical",
      title: "Mock conference setup failed",
      repro: "Run setupMockMunConference()",
      rootCause: err instanceof Error ? err.message : String(err),
    });
    writeBugReport();
    process.exit(1);
  }

  // --- Signup flow tests (organizer + 2 delegates via API) ---
  const signupSession = new HttpSession("signup");

  // Duplicate signup should 409
  {
    const first = await registerUser(
      signupSession,
      QA_PERSONAS.organizer.email,
      QA_PERSONAS.organizer.name,
      "organizer"
    );
    if (first.res.status === 409) {
      track("signup-organizer-dup", assertStep("signup-organizer-dup", true, "Organizer already exists (expected on re-run)"));
    } else {
      track(
        "signup-organizer",
        assertStep("signup-organizer", first.res.ok, first.res.ok ? "Organizer signup OK" : "Organizer signup failed", first.json)
      );
    }
  }

  {
    const aishaSignup = new HttpSession("aisha-signup");
    const res = await registerUser(aishaSignup, QA_PERSONAS.aisha.email, QA_PERSONAS.aisha.name, "delegate");
    track(
      "signup-aisha",
      assertStep(
        "signup-aisha",
        res.res.status === 409 || res.res.ok,
        res.res.ok ? "Aisha signup OK" : res.res.status === 409 ? "Aisha already exists" : "Aisha signup failed",
        res.json
      )
    );
  }

  {
    const rahulSignup = new HttpSession("rahul-signup");
    const res = await registerUser(rahulSignup, QA_PERSONAS.rahul.email, QA_PERSONAS.rahul.name, "delegate");
    track(
      "signup-rahul",
      assertStep(
        "signup-rahul",
        res.res.status === 409 || res.res.ok,
        res.res.ok ? "Rahul signup OK" : res.res.status === 409 ? "Rahul already exists" : "Rahul signup failed",
        res.json
      )
    );
  }

  // Wrong password
  {
    const badLogin = new HttpSession("bad-login");
    const { res } = await login(badLogin, QA_PERSONAS.aisha.email, "WrongPass1");
    track(
      "wrong-password",
      assertStep("wrong-password", !res.ok, !res.ok ? "Wrong password rejected" : "Wrong password incorrectly accepted")
    );
  }

  // --- Marketplace visibility ---
  {
    const { res, json } = await new HttpSession("public").request(`${baseUrl}/api/marketplace`);
    const found = Array.isArray((json as { conferences?: Array<{ id: string; title: string }> }).conferences)
      ? (json as { conferences: Array<{ id: string; title: string }> }).conferences.some(
          (c) => c.id === QA_EVENT_ID
        )
      : false;
    if (!found) {
      // Cache may lag — try detail endpoint directly
      const detail = await new HttpSession("detail").request(`${baseUrl}/api/marketplace/${QA_EVENT_ID}`);
      track(
        "marketplace-list",
        assertStep(
          "marketplace-list",
          detail.res.ok,
          detail.res.ok ? "Conference on marketplace (via detail; list cache may lag)" : "Conference not on marketplace",
          detail.json
        )
      );
    } else {
      track("marketplace-list", assertStep("marketplace-list", res.ok && found, "Conference visible on marketplace catalog"));
    }
  }

  {
    const { res, json } = await new HttpSession("detail").request(`${baseUrl}/api/marketplace/${QA_EVENT_ID}`);
    const conf = (json as { conference?: { title?: string; conferenceSchedule?: unknown[]; commonDocuments?: unknown[] } })
      .conference;
    const scheduleOk = Array.isArray(conf?.conferenceSchedule) && conf!.conferenceSchedule!.length > 0;
    const docsOk = Array.isArray(conf?.commonDocuments) && conf!.commonDocuments!.length > 0;
    track(
      "marketplace-detail",
      assertStep(
        "marketplace-detail",
        res.ok && Boolean(conf?.title?.includes("QA-TEST")) && scheduleOk && docsOk,
        res.ok ? "Marketplace detail has schedule + documents" : "Marketplace detail failed",
        json
      )
    );
  }

  // --- Checkout config ---
  let checkoutConfig: {
    registrationCategories?: Array<{ id: string; name: string }>;
    committees?: Array<{ id: string; name: string }>;
  } = {};
  {
    const { res, json } = await new HttpSession("checkout").request(
      `${baseUrl}/api/marketplace/${QA_EVENT_SLUG}/checkout-config`
    );
    checkoutConfig = json as typeof checkoutConfig;
    const cats = checkoutConfig.registrationCategories?.length ?? 0;
    const cmtes = checkoutConfig.committees?.length ?? 0;
    track(
      "checkout-config",
      assertStep("checkout-config", res.ok && cats >= 4 && cmtes >= 4, `Checkout config: ${cats} categories, ${cmtes} committees`, json)
    );
  }

  // --- Delegate registrations ---
  const aisha = new HttpSession("aisha");
  await login(aisha, QA_PERSONAS.aisha.email);
  {
    const { res, json } = await registerDelegate(
      aisha,
      "aisha",
      registrationBody({
        registrationId: `reg-qa-aisha-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.DELEGATE,
        categoryName: "Delegate Registration",
        fullName: QA_PERSONAS.aisha.name,
        school: "QA International School",
        phone: "9876543210",
        committeeConfigId: QA_COMMITTEE.UNSC,
        committeePreferences: [QA_COMMITTEE.UNSC, QA_COMMITTEE.UNHRC],
        countryPreferences: ["United States of America", "France"],
        portfolioPreferencesByCommittee: {
          [QA_COMMITTEE.UNSC]: ["United States of America", "France"],
        },
      })
    );
    track(
      "register-aisha",
      assertStep("register-aisha", res.ok, res.ok ? `Aisha registered (${registrations.aisha})` : "Aisha registration failed", json)
    );
    if (res.ok) {
      const paid = (json as { registration?: { paid?: boolean } }).registration?.paid;
      if (!paid) {
        logBug({
          severity: "medium",
          title: "Free delegate registration not auto-marked paid",
          repro: "Register with basePrice 0",
          rootCause: "createRegistrationAndPayment did not set paid:true",
        });
      }

      // Position paper submitted after allotment (see position-paper test step below)
    }
  }

  const rahul = new HttpSession("rahul");
  await login(rahul, QA_PERSONAS.rahul.email);
  {
    const { res, json } = await registerDelegate(
      rahul,
      "rahul",
      registrationBody({
        registrationId: `reg-qa-rahul-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.DELEGATE,
        categoryName: "Delegate Registration",
        fullName: QA_PERSONAS.rahul.name,
        school: "QA High School",
        phone: "9123456789",
        committeeConfigId: QA_COMMITTEE.UNHRC,
        committeePreferences: [QA_COMMITTEE.UNHRC],
      })
    );
    track("register-rahul", assertStep("register-rahul", res.ok, res.ok ? "Rahul registered (pending)" : "Rahul registration failed", json));
  }

  const sofia = new HttpSession("sofia");
  await login(sofia, QA_PERSONAS.sofia.email);
  {
    const { res, json } = await registerDelegate(
      sofia,
      "sofia",
      registrationBody({
        registrationId: `reg-qa-sofia-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.DELEGATE,
        categoryName: "Delegate Registration",
        fullName: QA_PERSONAS.sofia.name,
        school: "QA Model School",
        phone: "9234567890",
        committeeConfigId: QA_COMMITTEE.AIPPM,
        committeePreferences: [QA_COMMITTEE.AIPPM],
      })
    );
    track("register-sofia", assertStep("register-sofia", res.ok, res.ok ? "Sofia registered" : "Sofia registration failed", json));
  }

  const marcus = new HttpSession("marcus");
  await login(marcus, QA_PERSONAS.marcus.email);
  {
    const { res, json } = await registerDelegate(
      marcus,
      "marcus",
      registrationBody({
        registrationId: `reg-qa-marcus-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.DELEGATION,
        categoryName: "Delegation Registration",
        fullName: QA_PERSONAS.marcus.name,
        school: "QA Public School",
        phone: "9345678901",
      })
    );
    track("register-marcus", assertStep("register-marcus", res.ok, res.ok ? "Marcus (delegation head) registered" : "Marcus registration failed", json));
  }

  const priya = new HttpSession("priya");
  await login(priya, QA_PERSONAS.priya.email);

  const jordan = new HttpSession("jordan");
  await login(jordan, QA_PERSONAS.jordan.email);
  {
    const body = registrationBody({
      registrationId: `reg-qa-jordan-${randomUUID().slice(0, 8)}`,
      categoryId: QA_CATEGORY.DELEGATE,
      categoryName: "Delegate Registration",
      fullName: QA_PERSONAS.jordan.name,
      school: "QA Academy",
      phone: "9456789012",
      committeeConfigId: QA_COMMITTEE.UNHRC,
      committeePreferences: [QA_COMMITTEE.UNHRC],
    });
    const first = await registerDelegate(jordan, "jordan", body);
    track("register-jordan", assertStep("register-jordan", first.res.ok, first.res.ok ? "Jordan registered" : "Jordan registration failed", first.json));

    if (first.res.ok) {
      const dup = await registerDelegate(jordan, "jordan-dup", {
        ...body,
        registrationId: `reg-qa-jordan-dup-${randomUUID().slice(0, 8)}`,
      });
      track(
        "duplicate-registration",
        assertStep("duplicate-registration", dup.res.status === 409, dup.res.status === 409 ? "Duplicate registration returns 409" : "Duplicate registration should 409", dup.json)
      );
    }
  }

  const popov = new HttpSession("popov");
  await login(popov, QA_PERSONAS.popov.email);
  {
    const { res, json } = await registerDelegate(
      popov,
      "popov",
      registrationBody({
        registrationId: `reg-qa-popov-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.CHAIR,
        categoryName: "Chair Registration",
        fullName: QA_PERSONAS.popov.name,
        school: "QA University",
        phone: "9567890123",
      })
    );
    track("register-popov", assertStep("register-popov", res.ok, res.ok ? "Chair Popov registered" : "Popov registration failed", json));
  }

  const kwame = new HttpSession("kwame");
  await login(kwame, QA_PERSONAS.kwame.email);
  {
    const { res, json } = await registerDelegate(
      kwame,
      "kwame",
      registrationBody({
        registrationId: `reg-qa-kwame-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.CHAIR,
        categoryName: "Chair Registration",
        fullName: QA_PERSONAS.kwame.name,
        school: "QA College",
        phone: "9678901234",
      })
    );
    track("register-kwame", assertStep("register-kwame", res.ok, res.ok ? "Chair Kwame registered" : "Kwame registration failed", json));
  }

  const naomi = new HttpSession("naomi");
  await login(naomi, QA_PERSONAS.naomi.email);
  {
    const { res, json } = await registerDelegate(
      naomi,
      "naomi",
      registrationBody({
        registrationId: `reg-qa-naomi-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.DELEGATE,
        categoryName: "Delegate Registration",
        fullName: QA_PERSONAS.naomi.name,
        school: "QA Media Institute",
        phone: "9789012345",
        committeeConfigId: QA_COMMITTEE.PRESS,
        committeePreferences: [QA_COMMITTEE.PRESS],
      })
    );
    track("register-naomi", assertStep("register-naomi", res.ok, res.ok ? "Press Naomi registered" : "Naomi registration failed", json));
  }

  const liam = new HttpSession("liam");
  await login(liam, QA_PERSONAS.liam.email);
  {
    const { res, json } = await registerDelegate(
      liam,
      "liam-closed",
      registrationBody({
        registrationId: `reg-qa-liam-closed-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.CLOSED,
        categoryName: "Closed Category (QA)",
        fullName: QA_PERSONAS.liam.name,
        school: "QA Edge School",
        phone: "9890123456",
      })
    );
    track(
      "closed-category",
      assertStep(
        "closed-category",
        res.status === 400,
        res.status === 400 ? "Closed category correctly rejected" : "Closed category should return 400",
        json
      )
    );
  }

  // --- Delegation flow ---
  if (registrations.marcus) {
    const { res, json } = await marcus.request(`${baseUrl}/api/delegations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: QA_EVENT_ID,
        schoolName: "QA Public School Delegation",
        maxMembers: 8,
        registrationId: registrations.marcus,
      }),
    });
    delegationInviteToken = (json as { delegation?: { inviteToken?: string } }).delegation?.inviteToken || "";
    track(
      "create-delegation",
      assertStep(
        "create-delegation",
        res.ok && Boolean(delegationInviteToken),
        res.ok ? `Delegation created (token=${delegationInviteToken.slice(0, 8)}…)` : "Delegation creation failed",
        json
      )
    );
  }

  if (delegationInviteToken) {
    const joinGet = await priya.request(`${baseUrl}/api/delegations/join/${delegationInviteToken}`);
    track(
      "delegation-invite-preview",
      assertStep(
        "delegation-invite-preview",
        joinGet.res.ok,
        joinGet.res.ok ? "Delegation invite page data OK" : "Delegation invite preview failed",
        joinGet.json
      )
    );

    const joinPost = await priya.request(`${baseUrl}/api/delegations/join/${delegationInviteToken}`, {
      method: "POST",
    });
    track(
      "delegation-join",
      assertStep("delegation-join", joinPost.res.ok, joinPost.res.ok ? "Priya joined delegation" : "Delegation join failed", joinPost.json)
    );

    // Priya also registers individually
    const { res, json } = await registerDelegate(
      priya,
      "priya",
      registrationBody({
        registrationId: `reg-qa-priya-${randomUUID().slice(0, 8)}`,
        categoryId: QA_CATEGORY.DELEGATE,
        categoryName: "Delegate Registration",
        fullName: QA_PERSONAS.priya.name,
        school: "QA Public School",
        phone: "9901234567",
        committeeConfigId: QA_COMMITTEE.UNSC,
        committeePreferences: [QA_COMMITTEE.UNSC],
      })
    );
    track("register-priya", assertStep("register-priya", res.ok, res.ok ? "Priya individual registration OK" : "Priya registration failed", json));
  }

  // Invalid delegation token
  {
    const bad = await priya.request(`${baseUrl}/api/delegations/join/invalid-token-qa-000`, { method: "POST" });
    track(
      "invalid-delegation-token",
      assertStep("invalid-delegation-token", bad.res.status === 404, bad.res.status === 404 ? "Invalid token returns 404" : "Invalid token should 404")
    );
  }

  // --- Organizer actions ---
  const organizer = new HttpSession("organizer");
  await login(organizer, QA_PERSONAS.organizer.email);

  // Allot Aisha to UNSC / USA
  if (registrations.aisha) {
    const { res, json } = await organizerPatchRegistration(organizer, registrations.aisha, {
      organizerStatus: "Allotted",
      committeeName: "UN Security Council",
      portfolioName: "United States of America",
      portfolioId: QA_PORTFOLIO.USA,
    });
    track("allot-aisha", assertStep("allot-aisha", res.ok, res.ok ? "Aisha allotted to UNSC/USA" : "Aisha allotment failed", json));

    const release = await organizer.request(
      `${baseUrl}/api/organizers/conferences/${QA_EVENT_ID}/release-allotments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationIds: [registrations.aisha] }),
      }
    );
    track(
      "release-aisha-allotment",
      assertStep("release-aisha-allotment", release.res.ok, release.res.ok ? "Aisha allotment released" : "Release allotment failed", release.json)
    );
  }

  // Waitlist Sofia then promote
  if (registrations.sofia) {
    const wait = await organizerPatchRegistration(organizer, registrations.sofia, {
      organizerStatus: "Waitlisted",
    });
    track("waitlist-sofia", assertStep("waitlist-sofia", wait.res.ok, wait.res.ok ? "Sofia waitlisted" : "Waitlist failed", wait.json));

    const promote = await organizerPatchRegistration(organizer, registrations.sofia, {
      organizerStatus: "Allotted",
      committeeName: "AIPPM",
      portfolioName: "Bharatiya Janata Party",
    });
    track("promote-sofia", assertStep("promote-sofia", promote.res.ok, promote.res.ok ? "Sofia promoted to allotted" : "Promote failed", promote.json));

    await organizer.request(`${baseUrl}/api/organizers/conferences/${QA_EVENT_ID}/release-allotments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationIds: [registrations.sofia] }),
    });

    // Free registration is paid — reject-allotment should fail (expected)
    const reject = await sofia.request(
      `${baseUrl}/api/registrations/${registrations.sofia}/reject-allotment`,
      { method: "POST" }
    );
    track(
      "reject-allotment-paid",
      assertStep(
        "reject-allotment-paid",
        reject.res.status === 400,
        reject.res.status === 400
          ? "Paid registration cannot reject allotment (expected for free reg)"
          : "Reject allotment on paid reg should 400",
        reject.json
      )
    );
  }

  // Allot Popov (chair)
  if (registrations.popov) {
    const { res, json } = await organizerPatchRegistration(organizer, registrations.popov, {
      organizerStatus: "Allotted",
      committeeName: "UN Security Council",
    });
    track("allot-popov", assertStep("allot-popov", res.ok, res.ok ? "Chair Popov allotted" : "Popov allotment failed", json));
  }

  // Reject Kwame
  if (registrations.kwame) {
    const { res, json } = await organizerPatchRegistration(organizer, registrations.kwame, {
      organizerStatus: "Rejected",
    });
    track("reject-kwame", assertStep("reject-kwame", res.ok, res.ok ? "Chair Kwame rejected" : "Kwame rejection failed", json));
  }

  // Allot Naomi (press)
  if (registrations.naomi) {
    const { res, json } = await organizerPatchRegistration(organizer, registrations.naomi, {
      organizerStatus: "Allotted",
      committeeName: "International Press Corps",
    });
    track("allot-naomi", assertStep("allot-naomi", res.ok, res.ok ? "Press Naomi allotted" : "Naomi allotment failed", json));
  }

  // Organizer delegations list
  {
    const { res, json } = await organizer.request(`${baseUrl}/api/organizers/conferences/${QA_EVENT_ID}/delegations`);
    const hasDelegation = Array.isArray((json as { delegations?: unknown[] }).delegations)
      ? (json as { delegations: Array<{ schoolName?: string }> }).delegations.some((d) =>
          d.schoolName?.includes("QA Public School")
        )
      : false;
    track(
      "organizer-delegations",
      assertStep("organizer-delegations", res.ok && hasDelegation, res.ok ? "Organizer sees QA delegation" : "Delegations list failed", json)
    );
  }

  // Issue pass with immediate release via Prisma (no public API for immediate release)
  if (registrations.aisha) {
    const { issueDelegatePassForRegistration } = await import("../../src/lib/server/issue-delegate-pass");
    const passResult = await issueDelegatePassForRegistration(registrations.aisha, {
      immediateRelease: true,
    });
    track(
      "issue-pass",
      assertStep(
        "issue-pass",
        passResult.issued || passResult.alreadyIssued,
        passResult.issued || passResult.alreadyIssued
          ? `Pass issued (releaseAt immediate)`
          : `Pass issue failed: ${passResult.skipReason}`,
        passResult
      )
    );

    // Acknowledge committee documents before QR is exposed (required by /api/passes/me)
    const docs = await aisha.request(
      `${baseUrl}/api/registrations/${registrations.aisha}/committee-documents`
    );
    const docIds = (
      (docs.json as { documents?: Array<{ id: string }> }).documents || []
    ).map((d) => d.id);
    if (docIds.length > 0) {
      const ack = await aisha.request(
        `${baseUrl}/api/registrations/${registrations.aisha}/acknowledge-documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentIds: docIds }),
        }
      );
      track(
        "ack-documents",
        assertStep("ack-documents", ack.res.ok, ack.res.ok ? "Documents acknowledged" : "Document ack failed", ack.json)
      );
    } else {
      track("ack-documents", assertStep("ack-documents", true, "No committee documents to acknowledge"));
    }
  }

  // Check-in flow
  if (registrations.aisha) {
    const me = await aisha.request(`${baseUrl}/api/passes/me`);
    const passes = (me.json as { passes?: Array<{ registrationId: string; qrToken: string | null; released: boolean }> })
      .passes;
    const pass = passes?.find((p) => p.registrationId === registrations.aisha);
    aishaQrToken = pass?.qrToken || "";

    if (!aishaQrToken) {
      logBug({
        severity: "high",
        title: "Delegate pass QR token missing after immediate release",
        repro: "Allot + issueDelegatePassForRegistration(immediateRelease: true) + GET /api/passes/me",
      });
      track("pass-qr", assertStep("pass-qr", false, "No QR token on pass"));
    } else {
      track("pass-qr", assertStep("pass-qr", true, "Aisha has QR token"));

      const verify = await organizer.request(`${baseUrl}/api/passes/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: aishaQrToken }),
      });
      track(
        "verify-pass",
        assertStep(
          "verify-pass",
          verify.res.ok && (verify.json as { valid?: boolean }).valid === true,
          "QR verify OK",
          verify.json
        )
      );

      const checkin = await organizer.request(`${baseUrl}/api/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: aishaQrToken }),
      });
      track("checkin", assertStep("checkin", checkin.res.ok, "First check-in OK", checkin.json));

      const checkinAgain = await organizer.request(`${baseUrl}/api/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: aishaQrToken }),
      });
      track(
        "double-checkin",
        assertStep("double-checkin", checkinAgain.res.status === 409, checkinAgain.res.status === 409 ? "Double check-in returns 409" : "Double check-in should 409")
      );
    }

    const badQr = await organizer.request(`${baseUrl}/api/passes/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: "tampered-qr-token-qa" }),
    });
    track(
      "tampered-qr",
      assertStep("tampered-qr", !badQr.res.ok || (badQr.json as { valid?: boolean }).valid === false, "Tampered QR rejected")
    );
  }

  // Position paper API
  if (registrations.aisha) {
    const paperPost = await aisha.request(
      `${baseUrl}/api/registrations/${registrations.aisha}/position-paper`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          committeeId: QA_COMMITTEE.UNSC,
          textContent: "QA position paper on Middle East crisis response.",
        }),
      }
    );
    track(
      "position-paper-submit",
      assertStep(
        "position-paper-submit",
        paperPost.res.ok,
        paperPost.res.ok ? "Position paper submitted" : "Position paper submit failed",
        paperPost.json
      )
    );

    const paper = await aisha.request(`${baseUrl}/api/registrations/${registrations.aisha}/position-paper`);
    track(
      "position-paper",
      assertStep("position-paper", paper.res.ok, paper.res.ok ? "Position paper API reachable" : "Position paper API failed", paper.json)
    );
  }

  // Jordan withdraw + re-register
  if (registrations.jordan) {
    const withdraw = await jordan.request(`${baseUrl}/api/registrations/${registrations.jordan}`, {
      method: "DELETE",
    });
    // Free reg is paid — withdraw should fail
    if (withdraw.res.status === 400) {
      track(
        "withdraw-paid",
        assertStep("withdraw-paid", true, "Paid (free) registration cannot withdraw — expected")
      );
    } else if (withdraw.res.ok) {
      const reReg = await registerDelegate(
        jordan,
        "jordan-rereg",
        registrationBody({
          registrationId: `reg-qa-jordan-rereg-${randomUUID().slice(0, 8)}`,
          categoryId: QA_CATEGORY.DELEGATE,
          categoryName: "Delegate Registration",
          fullName: QA_PERSONAS.jordan.name,
          school: "QA Academy",
          phone: "9456789012",
          committeeConfigId: QA_COMMITTEE.UNHRC,
          committeePreferences: [QA_COMMITTEE.UNHRC],
        })
      );
      track(
        "withdraw-reregister",
        assertStep("withdraw-reregister", reReg.res.ok, reReg.res.ok ? "Jordan re-registered after withdraw" : "Re-register failed", reReg.json)
      );
    } else {
      track("withdraw", assertStep("withdraw", false, "Unexpected withdraw response", withdraw.json));
    }
  }

  // Organizer cannot register as delegate
  {
    const orgReg = await organizer.request(`${baseUrl}/api/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        registrationBody({
          registrationId: `reg-qa-org-blocked-${randomUUID().slice(0, 8)}`,
          categoryId: QA_CATEGORY.DELEGATE,
          categoryName: "Delegate Registration",
          fullName: "Blocked Organizer",
          school: "N/A",
          phone: "9012345678",
        })
      ),
    });
    track(
      "organizer-cannot-register",
      assertStep("organizer-cannot-register", orgReg.res.status === 403, orgReg.res.status === 403 ? "Organizer blocked from delegate registration" : "Organizer should not register as delegate")
    );
  }

  // Conference config patch (organizer)
  {
    const marker = `QA Overview ${Date.now()}`;
    const patch = await organizer.request(`${baseUrl}/api/organizers/conference-config/${QA_EVENT_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: marker, tags: ["QA", "E2E"] }),
    });
    track(
      "organizer-config-patch",
      assertStep("organizer-config-patch", patch.res.ok, patch.res.ok ? "Organizer config patch OK" : "Config patch failed", patch.json)
    );

    const detail = await new HttpSession("detail-after-patch").request(`${baseUrl}/api/marketplace/${QA_EVENT_ID}`);
    const desc = (detail.json as { conference?: { description?: string } }).conference?.description || "";
    track(
      "config-sync-marketplace",
      assertStep("config-sync-marketplace", desc.includes(marker), desc.includes(marker) ? "Config visible on marketplace" : "Config not synced to marketplace", detail.json)
    );
  }

  // UI smoke: fetch rendered pages (no Playwright browser required)
  {
    const catalog = await fetch(`${baseUrl}/api/marketplace`);
    const catalogJson = (await catalog.json().catch(() => ({}))) as {
      conferences?: Array<{ id: string; title: string }>;
    };
    const inCatalog = catalogJson.conferences?.some((c) => c.id === QA_EVENT_ID) ?? false;
    track(
      "ui-marketplace-api",
      assertStep(
        "ui-marketplace-api",
        catalog.ok && inCatalog,
        inCatalog ? "QA conference in marketplace API" : "QA conference missing from marketplace API"
      )
    );

    const pages = [
      { name: "conference-detail", path: `/conference/${QA_EVENT_ID}`, needle: "QA-TEST" },
      { name: "checkout", path: `/checkout/${QA_EVENT_SLUG}`, needle: /Delegate|checkout|Register/i },
    ];
    for (const pg of pages) {
      try {
        const res = await fetch(`${baseUrl}${pg.path}`);
        const html = await res.text();
        const found =
          pg.needle instanceof RegExp
            ? pg.needle.test(html)
            : html.includes(pg.needle);
        track(
          `ui-${pg.name}`,
          assertStep(
            `ui-${pg.name}`,
            res.ok && found,
            res.ok && found ? `${pg.path} renders expected content` : `${pg.path} missing expected content`,
            { status: res.status }
          )
        );
      } catch (err) {
        track(
          `ui-${pg.name}`,
          assertStep(`ui-${pg.name}`, false, `Failed to fetch ${pg.path}`, {
            error: err instanceof Error ? err.message : String(err),
          })
        );
      }
    }
  }

  // Optional Playwright UI (skipped when browsers not installed)
  {
    const { spawnSync } = await import("node:child_process");
    const ui = spawnSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["playwright", "test", "e2e/mock-mun-ui.spec.ts", "--reporter=line", "--workers=1"],
      {
        cwd: process.cwd(),
        env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
        encoding: "utf8",
        shell: process.platform === "win32",
      }
    );
    const combined = `${ui.stderr || ""}\n${ui.stdout || ""}`;
    const browserMissing =
      combined.includes("npx playwright install") || combined.includes("Executable doesn't exist");
    if (browserMissing) {
      track(
        "ui-playwright",
        assertStep("ui-playwright", true, "Playwright browsers not installed — skipped (run npx playwright install)")
      );
    } else {
      const uiOk = ui.status === 0;
      track(
        "ui-playwright",
        assertStep(
          "ui-playwright",
          uiOk,
          uiOk ? "Playwright UI walkthrough passed" : "Playwright UI walkthrough had failures",
          uiOk ? undefined : { stdout: ui.stdout?.slice(-1500), stderr: ui.stderr?.slice(-1500) }
        )
      );
    }
  }

  // Revert event to DRAFT before cleanup (minimize marketplace exposure)
  {
    const { prisma } = await import("../../src/lib/server/prisma");
    const { mergeOrganizerStoredBlob } = await import("../../src/lib/server/organizer-config-store");
    await prisma.event.update({
      where: { id: QA_EVENT_ID },
      data: { status: "DRAFT" },
    });
    await mergeOrganizerStoredBlob(QA_EVENT_ID, { status: "Draft" });
    await prisma.$disconnect();
    track("unpublish", assertStep("unpublish", true, "Conference reverted to DRAFT"));
  }

  // Summary
  console.log(`\n=== Results: ${failures} failure(s) ===\n`);

  const reportPath = writeBugReport(
    [
      "## Test personas",
      "",
      Object.entries(QA_PERSONAS)
        .map(([k, p]) => `- **${k}**: ${p.email}`)
        .join("\n"),
      "",
      `Conference: ${QA_EVENT_TITLE} (\`${QA_EVENT_ID}\`)`,
      "",
    ].join("\n")
  );
  console.log(`Report written to ${reportPath}`);

  // Cleanup
  console.log("\nRunning cleanup…");
  await cleanupMockMun();

  if (failures > 0 || getBugLog().some((b) => !b.fixed)) {
    const openBugs = getBugLog().filter((b) => !b.fixed);
    if (openBugs.length > 0) {
      console.log(`\n${openBugs.length} open bug(s) to fix.`);
    }
    process.exit(failures > 0 ? 1 : 0);
  }

  console.log("\nMock MUN QA test passed with no open bugs.");
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  try {
    await cleanupMockMun();
  } catch {
    // best effort
  }
  process.exit(1);
});
