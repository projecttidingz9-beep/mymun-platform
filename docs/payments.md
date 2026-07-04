# Payments

## Modes

Configured via environment (`PAYMENTS_MODE` / related vars in `.env.example`):

- **FREE**: zero-amount registrations without a payment step beyond confirmation.
- **cashfree**: paid registrations use Cashfree Payment Gateway (hosted checkout). All payments settle to the platform Tidingz merchant account.

Legacy **MANUAL** intents may still exist in the database from before Cashfree; new registrations use **CASHFREE** or **FREE** only.

## Cashfree setup

1. Create a Cashfree merchant account and generate Payment Gateway API keys.
2. Set in `.env.local` / Vercel:
   - `CASHFREE_CLIENT_ID`
   - `CASHFREE_CLIENT_SECRET` (also used to verify webhook HMAC signatures)
   - `NEXT_PUBLIC_CASHFREE_MODE=sandbox` or `production`
   - `PAYMENTS_MODE=cashfree`
3. Configure webhook URL: `https://<your-domain>/api/webhooks/cashfree`
4. Subscribe to **Success Payment** (and optionally Failed / User Dropped) events in the Cashfree dashboard.
5. Use webhook version **2025-01-01**.

> **Note:** `CASHFREE_WEBHOOK_SECRET` in older docs is not used — webhook signature verification uses `CASHFREE_CLIENT_SECRET` via the Cashfree SDK.

## APIs

- **`POST /api/registrations`**: Creates registration + payment intent (`FREE` or `CASHFREE`).
- **`POST /api/payments/cashfree/orders`**: Creates a Cashfree order (`registrationId` or `paymentIntentId`) and returns `payment_session_id`.
- **`GET /api/payments/cashfree/orders/[orderId]`**: Polls order status after redirect.
- **`POST /api/webhooks/cashfree`**: Cashfree payment webhooks (signature-verified via client secret).

Organizer payment visibility is on the dashboard **Transactions** section (mapped from registrations + payment intents).

## Flow

1. Delegate submits checkout → `PaymentIntent` with `provider: CASHFREE`, `status: PENDING`.
2. Client opens Cashfree hosted checkout via `@cashfreepayments/cashfree-js`.
3. Cashfree webhook (and return-page poll) confirms payment → `CONFIRMED`, `Registration.paid = true`.
4. Unpaid delegates can retry via **Pay now** on the dashboard or checkout confirmation step.
5. Delegate can download invoice; organizer sees payment in dashboard (no manual mark-as-paid for Cashfree).

## Testing

```bash
# Unit tests (webhook helpers, order parsing, phone validation)
npm test

# API-level flow against local dev server (requires db:seed + npm run dev)
node scripts/test-payment-flow.mjs http://localhost:3000

# Simulate a signed webhook for an existing order id
node scripts/simulate-cashfree-webhook.mjs tid_pi_abc123 http://localhost:3000
```

Cashfree sandbox test card: `4111111111111111`, CVV `123`, any future expiry.

## Cashfree test conference (₹10)

Create or refresh a published mock MUN on production (non-destructive upsert):

```bash
npm run create:cashfree-test-mun
```

This creates **Cashfree Test MUN** (`cashfree-test-mun`) with delegate registration at **₹10**. Optional env: `CASHFREE_TEST_ORGANIZER_EMAIL` (default `organizer1@tidingz.demo`).

After running:

1. Sign in as a delegate at `https://tidingz.com`
2. Open `https://tidingz.com/checkout/cashfree-test-mun`
3. Complete registration and pay with the sandbox test card above (or a real ₹10 payment in production mode)

Verify API:

```bash
curl -s https://tidingz.com/api/marketplace/cashfree-test-mun/checkout-config
```

## Limitations

- Cashfree refunds are recorded in the database only; the Cashfree Refund API is not called automatically from the organizer dashboard.
