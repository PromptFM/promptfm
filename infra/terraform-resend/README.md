# Resend inbound mail (promptfm.live)

Resend receives every address on `promptfm.live` through one MX record and POSTs it to `https://promptfm.live/api/webhooks/resend`, which forwards it. This module owns the webhook and keeps its signing secret in Secret Manager.

The addresses are declared in [`config/inbound-forwarding.json`](../../config/inbound-forwarding.json), the same file the app reads (`src/lib/email/forwarding.ts`):

| Address | Category | Forwards to |
| :--- | :--- | :--- |
| `dev@`, `contact@` | contact | `default_forward_to` |
| `report@`, `legal@` | complaint (goes to the moderation queue too) | `default_forward_to` |

To add an address: add it under `aliases` (optionally with its own `forward_to`), merge, then run the apply below. Any other address on the domain still reaches `default_forward_to` as contact mail.

## Run it

```bash
npm run infra:resend:plan     # preview
npm run infra:resend:apply    # apply
```

Needs `terraform` and a Google login (`gcloud auth login`). The Resend API key is read from the Secret Manager secret `promptfm-resend-api-key`, so it works the same on a laptop and in CI. State is in the GCS bucket under `terraform/resend-state`.

## Secrets

| Secret Manager | Env var | Used by |
| :--- | :--- | :--- |
| `promptfm-resend-api-key` | `RESEND_API_KEY` | the app (sending and forwarding), `npm run promptfm -- email list`, this module |
| `promptfm-resend-webhook-secret` | `RESEND_WEBHOOK_SECRET` | the webhook signing secret. The app does not check signatures yet, so Vercel does not need it |
