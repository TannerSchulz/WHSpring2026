# MortgageAI marketing site

This folder contains the standalone B2B sales site for MortgageAI. It is a standard Next.js project with no deployment provider, hosted database, or platform-specific configuration included.

## Run locally

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Validate

```bash
pnpm lint
pnpm build
```

## Connect the pilot request form

The form UI is included but no lead data is stored by this repository. Set `NEXT_PUBLIC_DEMO_FORM_ENDPOINT` to your own CRM, form service, or API endpoint when you are ready to connect it.

Set `NEXT_PUBLIC_SITE_URL` when deploying later if you want absolute social-sharing metadata for your final domain.
