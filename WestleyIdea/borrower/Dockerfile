ARG APP_VERSION=dev

FROM node:22-alpine AS builder
ARG APP_VERSION
ENV VITE_APP_VERSION=$APP_VERSION
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm test
RUN npm run build

FROM nginx:1.29-alpine AS runner
ARG APP_VERSION
LABEL org.opencontainers.image.title="MortgageAI Borrower"
LABEL org.opencontainers.image.version=$APP_VERSION
ENV API_UPSTREAM=http://api:8080
ENV NGINX_ENVSUBST_FILTER=API_UPSTREAM

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
