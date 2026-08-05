# Aquairy.com

Static acquisition landing page for **Aquairy.com**, an acquisition-ready brand concept for water intelligence, climate technology and infrastructure analytics.

## Repository structure

- `index.html` — production landing page
- `404.html` — fallback page
- `_headers` — Cloudflare Pages cache rules
- `assets/favicon.svg` — site icon
- `robots.txt` and `sitemap.xml` — search-engine directives

## Cloudflare Pages configuration

This project is plain static HTML and does not require a build step.

- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `.`
- Root directory: leave blank
- Production branch: `main`

After the first successful deployment, add `aquairy.com` under **Custom domains** in the Cloudflare Pages project.

## Contact configuration

The acquisition form is processed by a Cloudflare Pages Function and delivered with Resend. Configure these values under **Cloudflare Pages → Settings → Variables and Secrets**:

- `RESEND_API_KEY` — encrypted secret created in Resend
- `INQUIRY_TO_EMAIL` — destination inbox that will receive inquiries
- `RESEND_FROM_EMAIL` — verified sender, recommended value: `Aquairy Offers <offers@send.aquairy.com>`

Verify `send.aquairy.com` in Resend before testing production delivery. Never commit the Resend API key to this repository.

## Positioning note

Aquairy is presented as a brand concept available for acquisition. Product interfaces and possible applications are illustrative and do not represent an operating company or live technology.
