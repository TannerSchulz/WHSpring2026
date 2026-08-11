# MortgageAI Borrower Experience

The public home-budget questionnaire used through tracked loan-officer links.

## Tracked workflow

A URL such as `/advisor-slug/campaign-slug` loads the active borrower link through the API, records one visit per browser session, and applies the assigned company and loan-officer branding. The final step collects contact details and explicit consent. The questionnaire and its Low, Average, and Stretch scenarios are then saved to the organization-scoped CRM.

The borrower browser never receives `PORTAL_API_KEY` and never selects an organization ID. Link attribution is resolved by the API from the randomized stored slug.

## Configuration

The nginx container proxies same-origin `/api` requests to the internal API service:

```text
API_UPSTREAM=http://api
```

## Validation

```bash
npm run validate
```

The production container listens on port `8080`.
