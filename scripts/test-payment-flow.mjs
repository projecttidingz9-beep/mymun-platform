#!/usr/bin/env node
/**
 * API-level payment flow smoke test (registration → Cashfree order → webhook confirm).
 *
 * Usage:
 *   node scripts/test-payment-flow.mjs [baseUrl]
 *
 * Requires: seeded DB, dev server running, Cashfree sandbox credentials in .env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    while (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).trim();
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const baseUrl = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

const SEED_EVENT_ID = "evt-seed-global-summit-2026";
const SEED_EVENT_SLUG = "global-summit-mun-2026";
const DELEGATE_EMAIL = "delegate3@tidingz.demo";
const PASSWORD = "TidingzDemo1";

function fail(step, message, extra) {
  console.error(`FAIL [${step}]: ${message}`);
  if (extra) console.error(extra);
  process.exit(1);
}

function ok(step, message) {
  console.log(`OK  [${step}]: ${message}`);
}

const jar = new Map();

function parseSetCookie(header) {
  if (!header) return;
  const parts = header.split(/,(?=\s*[^;,]+=)/);
  for (const part of parts) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...(jar.size ? { cookie: cookieHeader() } : {}),
  };
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const c of setCookie) parseSetCookie(c);
  const legacy = res.headers.get("set-cookie");
  if (legacy) parseSetCookie(legacy);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

console.log(`Testing payment flow against ${baseUrl}\n`);

// 1. Health
{
  const { res, json } = await api("/api/health");
  if (!res.ok || !json.ok) fail("health", "App not healthy", json);
  ok("health", "API healthy");
}

// 2. Seed catalog
{
  const { res, json } = await api("/api/marketplace");
  const found = Array.isArray(json.conferences) && json.conferences.some((c) => c.id === SEED_EVENT_ID);
  if (!res.ok || !found) {
    fail("seed", `Seed conference ${SEED_EVENT_ID} not found. Run: npm run db:seed`);
  }
  ok("seed", "Seed conference published on marketplace");
}

// 3. Checkout config
let categoryId = "";
let committeeId = "";
{
  const { res, json } = await api(`/api/marketplace/${SEED_EVENT_SLUG}/checkout-config`);
  if (!res.ok) fail("checkout-config", "Could not load checkout config", json);
  const cat = json.registrationCategories?.[0];
  if (!cat?.id) fail("checkout-config", "No registration categories", json);
  categoryId = cat.id;
  const committee = json.committees?.[0];
  if (!committee?.id) fail("checkout-config", "No committees configured", json);
  committeeId = committee.id;
  ok("checkout-config", `Category: ${cat.name}, Committee: ${committee.name || committee.id}`);
}

// 4. Login delegate3
{
  const { res, json } = await api("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DELEGATE_EMAIL, password: PASSWORD }),
  });
  if (!res.ok) fail("login", `Could not log in as ${DELEGATE_EMAIL}`, json);
  ok("login", DELEGATE_EMAIL);
}

// 5. Register
let registrationId = `reg-test-${Date.now()}`;
let paymentIntentId = "";
{
  const { res, json } = await api("/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationId,
      eventId: SEED_EVENT_ID,
      categoryId,
      categoryName: "Delegate Registration",
      fullName: "Payment Test Delegate",
      school: "Test School",
      formAnswers: { fullName: "Payment Test Delegate", school: "Test School", phone: "9876543210" },
      committeeConfigId: committeeId,
      committeePreferences: [committeeId],
    }),
  });
  if (res.status === 409) {
    ok("register", "Delegate already registered — continuing with existing intent lookup via new registration attempt skipped");
    // Try delegate4 instead
    registrationId = "";
  } else if (!res.ok) {
    fail("register", "Registration failed", json);
  } else {
    paymentIntentId = json.registration?.paymentIntentId || "";
    registrationId = json.registration?.registrationId || json.clientRegistration?.id || registrationId;
    if (!paymentIntentId) fail("register", "No paymentIntentId returned", json);
    ok("register", `registrationId=${registrationId}, paymentIntentId=${paymentIntentId}`);
  }
}

if (!paymentIntentId) {
  // fallback: login delegate4
  jar.clear();
  const login = await api("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "delegate4@tidingz.demo", password: PASSWORD }),
  });
  if (!login.res.ok) fail("register", "Could not use alternate delegate", login.json);
  registrationId = `reg-test-${Date.now()}`;
  const reg = await api("/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationId,
      eventId: SEED_EVENT_ID,
      categoryId,
      categoryName: "Delegate Registration",
      fullName: "Payment Test Delegate Four",
      school: "Test School",
      formAnswers: {
        fullName: "Payment Test Delegate Four",
        school: "Test School",
        phone: "9123456789",
      },
      committeeConfigId: committeeId,
      committeePreferences: [committeeId],
    }),
  });
  if (!reg.res.ok) fail("register", "Alternate delegate registration failed", reg.json);
  paymentIntentId = reg.json.registration?.paymentIntentId || "";
  registrationId = reg.json.registration?.registrationId || registrationId;
  ok("register", `delegate4 registrationId=${registrationId}`);
}

// 6. Phone validation rejects bad input
{
  const { res, json } = await api("/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationId: `reg-bad-${Date.now()}`,
      eventId: SEED_EVENT_ID,
      categoryId,
      categoryName: "Delegate Registration",
      fullName: "Bad Phone",
      school: "Test School",
      formAnswers: { phone: "123" },
    }),
  });
  if (res.status !== 400) fail("phone-validation", "Expected 400 for invalid phone", json);
  ok("phone-validation", "Server rejects invalid phone");
}

// 7. Create Cashfree order
let orderId = "";
{
  const { res, json } = await api("/api/payments/cashfree/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentIntentId,
      eventId: SEED_EVENT_SLUG,
      customerPhone: "9876543210",
    }),
  });
  if (res.status === 503) fail("cashfree-order", "Cashfree not configured (503)", json);
  if (!res.ok) fail("cashfree-order", "Could not create Cashfree order", json);
  orderId = json.orderId || "";
  if (!orderId || !json.paymentSessionId) fail("cashfree-order", "Missing orderId/paymentSessionId", json);
  ok("cashfree-order", `orderId=${orderId}`);
}

// 8. Simulate signed webhook
{
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/simulate-cashfree-webhook.mjs"), orderId, baseUrl],
    { cwd: root, encoding: "utf8", env: process.env }
  );
  if (result.status !== 0) {
    fail("webhook", "Webhook simulation failed", result.stderr || result.stdout);
  }
  ok("webhook", "Signed webhook accepted");
}

// 9. Poll order status
{
  const { res, json } = await api(`/api/payments/cashfree/orders/${encodeURIComponent(orderId)}`);
  if (!res.ok) fail("poll", "Order poll failed", json);
  if (!json.paid) fail("poll", "Registration not marked paid after webhook", json);
  ok("poll", `paid=true, registrationId=${json.registrationId}`);
}

console.log("\nPayment flow test passed.");
