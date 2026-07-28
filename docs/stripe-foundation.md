# Stripe billing foundation

The billing foundation is intentionally inert until all Stripe environment
variables are configured. Checkout and portal endpoints return HTTP 503 with
`STRIPE_NOT_CONFIGURED` before making any Stripe request.

## Included

- Hosted subscription Checkout Session endpoint: `POST /api/billing/checkout`
- Stripe-hosted customer portal endpoint: `POST /api/billing/portal`
- Signed, idempotent webhook endpoint: `POST /api/billing/webhook`
- Typed Creator/Studio monthly and annual price mapping
- Supabase subscription projection and webhook-event ledger migration
- Rate limiting and authenticated user lookup for checkout creation

## Test-mode setup

1. Create recurring Creator and Studio products in Stripe, each with monthly
   and annual Prices.
2. Add the test secret key and four `price_...` IDs using `.env.example`.
3. Apply `supabase/migrations/202607120001_stripe_billing_foundation.sql`.
4. In Stripe, create a webhook endpoint ending in `/api/billing/webhook` and
   subscribe it to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Set the webhook signing secret as `STRIPE_WEBHOOK_SECRET`.
6. Configure the Stripe customer portal in test mode.
7. Restore SoundStage authentication before enabling checkout buttons. The
   server endpoints intentionally require a verified Supabase user.

## Launch gates

- Never place `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in a public env var.
- Test new purchase, renewal, failed payment, cancel-at-period-end, cancellation,
  plan change, and webhook replay behavior using Stripe test mode.
- Confirm the final plan entitlements and downgrade rules before enforcing them.
- Replace all test keys and test Price IDs with live-mode values only at launch.
