# MortgageAI marketing site

This folder contains the standalone B2B sales site for MortgageAI. It is a standard Next.js project with no hosted database. Its Dockerfile produces a standalone Node.js container for Azure Container Apps or another container platform.

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

## Container

The production container listens on port `8080`, matching the borrower container and the expected Azure Container Apps ingress target port.

```bash
docker build . -t mortgageai-marketing
docker run --rm -p 8080:8080 mortgageai-marketing
```

The `Marketing` GitHub Actions workflow supplies `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_DEMO_FORM_ENDPOINT` as public build-time values, then pushes the image to Azure Container Registry and updates the marketing Azure Container App on the `demo` branch.
