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

## Pilot request form

The form is a visual preview only. It has no endpoint, performs no network request, and does not store information in the browser or elsewhere.

## Container

The production container listens on port `8080`, matching the borrower container and the expected Azure Container Apps ingress target port.

```bash
docker build . -t mortgageai-marketing
docker run --rm -p 8080:8080 mortgageai-marketing
```

The `Marketing` GitHub Actions workflow builds the self-contained application, pushes the image to Azure Container Registry, and updates the marketing Azure Container App on the `demo` branch.
