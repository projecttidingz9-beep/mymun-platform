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
   - `CASHFREE_CLIENT_SECRET`
   - `CASHFREE_WEBHOOK_SECRET` (from Developers → Webhooks)
   - `NEXT_PUBLIC_CASHFREE_MODE=sandbox` or `production`
   - `PAYMENTS_MODE=cashfree`
3. Configure webhook URL: `https://<your-domain>/api/webhooks/cashfree`

## APIs

- **`POST /api/registrations`**: Creates registration + payment intent (`FREE` or `CASHFREE`).
- **`POST /api/payments/cashfree/orders`**: Creates a Cashfree order and returns `payment_session_id` for checkout.
- **`GET /api/payments/cashfree/orders/[orderId]`**: Polls order status after redirect.
- **`POST /api/webhooks/cashfree`**: Cashfree payment webhooks (signature-verified).
- **`GET /api/organizers/payment-intents/[eventId]`**: Organizer payment list for reconciliation.

## Flow

1. Delegate submits checkout → `PaymentIntent` with `provider: CASHFREE`, `status: PENDING`.
2. Client opens Cashfree hosted checkout via `@cashfreepayments/cashfree-js`.
3. Cashfree webhook (and return-page poll) confirms payment → `CONFIRMED`, `Registration.paid = true`.
4. Delegate can download invoice; organizer sees payment in dashboard (no manual mark-as-paid for Cashfree).
