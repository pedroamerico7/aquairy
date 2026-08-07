# JusticiaAI.com landing page

Static landing page prepared for GitHub and Cloudflare Pages, with a Pages
Function that delivers acquisition inquiries through Resend.

## Cloudflare Pages

- Framework preset: None
- Build command: leave blank
- Build output directory: `/`

The custom domain should be configured as `justiciai.com` after deployment.

## Acquisition form

The `Make an Offer` and `Ask a Question` buttons open an embedded acquisition
form. The browser posts JSON to the same-origin `/api/inquiry` endpoint. The
endpoint is implemented in `functions/api/inquiry.js`, so no separate Worker
or `workers.dev` URL is required. Buyers are never asked to verify or confirm
their email address.

Required Cloudflare Pages variables/secrets:

- `RESEND_API_KEY` — secret; reuse the existing Resend API key.
- `RESEND_FROM_EMAIL` — sender on the Resend-verified `quantivalue.com` domain,
  for example `JusticiaAI <offers@quantivalue.com>`.
- `INQUIRY_TO_EMAIL` — `offers@justiciai.com`.

Cloudflare Email Routing can continue forwarding `offers@justiciai.com` to the
owner's Gmail inbox. After adding or changing the variables, redeploy the Pages
project so the Function receives the current configuration.
