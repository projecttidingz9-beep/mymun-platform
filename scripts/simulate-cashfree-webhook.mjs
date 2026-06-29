#!/usr/bin/env node
/**
 * Send a signed Cashfree PAYMENT_SUCCESS_WEBHOOK to your app.
 *
 * Usage:
 *   node scripts/simulate-cashfree-webhook.mjs <orderId> [baseUrl]
 *
 * Requires CASHFREE_CLIENT_SECRET in .env.local (same key used for webhook HMAC).
 */
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const orderId = process.argv[2]?.trim();
const baseUrl = (process.argv[3] || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const secret = process.env.CASHFREE_CLIENT_SECRET?.trim();

if (!orderId) {
  console.error("Usage: node scripts/simulate-cashfree-webhook.mjs <orderId> [baseUrl]");
  process.exit(1);
}
if (!secret) {
  console.error("Missing CASHFREE_CLIENT_SECRET in environment.");
  process.exit(1);
}

const payload = {
  data: {
    order: {
      order_id: orderId,
      order_amount: 3000,
      order_currency: "INR",
      order_status: "PAID",
    },
    payment: {
      cf_payment_id: "sim_test_payment",
      payment_status: "SUCCESS",
      payment_amount: 3000,
      payment_currency: "INR",
    },
  },
  event_time: new Date().toISOString(),
  type: "PAYMENT_SUCCESS_WEBHOOK",
};

const rawBody = JSON.stringify(payload);
const timestamp = String(Date.now());
const signature = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");

const url = `${baseUrl}/api/webhooks/cashfree`;
console.log(`POST ${url}`);
console.log(`order_id: ${orderId}`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-webhook-signature": signature,
    "x-webhook-timestamp": timestamp,
  },
  body: rawBody,
});

const text = await res.text();
console.log(`Status: ${res.status}`);
console.log(text);

if (!res.ok) {
  process.exit(1);
}

console.log("Webhook accepted. Verify registration.paid in dashboard or database.");
