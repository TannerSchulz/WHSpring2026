ARG APP_VERSION=dev

FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@11.16.0 --activate
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG APP_VERSION
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_DEMO_FORM_ENDPOINT
ENV APP_VERSION=$APP_VERSION
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_DEMO_FORM_ENDPOINT=$NEXT_PUBLIC_DEMO_FORM_ENDPOINT
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN corepack prepare pnpm@11.16.0 --activate
RUN pnpm build

FROM node:22-alpine AS runner
ARG APP_VERSION
LABEL org.opencontainers.image.title="MortgageAI Marketing"
LABEL org.opencontainers.image.version=$APP_VERSION
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
