# MortgageAI Loan Officer

The loan-officer workspace for reviewing borrower affordability submissions, managing shareable links, and organizing follow-up.

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Validation

```bash
pnpm lint
pnpm build
```

## Current scope

This build is a frontend product prototype with realistic in-memory data. It does not authenticate users, persist records, call a CRM, or make external API requests. Those integrations can be added behind the existing workspace views when the shared backend and account model are ready.

## Container

The container listens on port `8080` and is published by the `Loan Officer` GitHub Actions workflow as `mortgageai-loan-officer`.
