# MortgageAI marketing site

The B2B sales site for MortgageAI. It explains the loan-officer workflow, presents the founding-partner pilot, and stores demo requests in Cloudflare D1.

## Local development

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm dev
```

## Validation

```bash
pnpm lint
pnpm build
pnpm db:generate
```

Database migrations are stored in `drizzle/`. Sites hosting configuration lives in `.openai/hosting.json`.
