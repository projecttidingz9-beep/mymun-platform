# Payments

## Modes

Configured via environment (`PAYMENTS_MODE` / related vars in `.env.example`):

- **FREE**: zero-amount registrations without a payment step beyond confirmation.
- **MANUAL**: delegates see organizer bank/UPI instructions; a **PaymentIntent** row tracks amount/status until finance confirms.

There is **no card gateway** in-repo; integrating Stripe/Razorpay would add a provider module under `src/lib/server/payments/` and new webhook routes.

## APIs

- **`POST /api/registrations`**: Creates/updates registration + payment intent from server-side pricing (`resolve-registration-price`).
- **`GET /api/organizers/payment-intents/[eventId]`**: Organizer-only list of manual intents for reconciliation (`/organizers/payments` UI).

## Operations

1. Delegate completes checkout → `PaymentIntent` typically `PENDING`.
2. Organizer verifies bank/UPI receipt offline.
3. Future step: POST action to mark intent **CONFIRMED** and flip `Registration.paid` (partially automated today depending on branch).

Keep audit-friendly notes in `PaymentIntent.notes` / `reference` when confirming manually.
