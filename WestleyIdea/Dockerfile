ARG APP_VERSION=dev

# ── Stage 1: Build the borrower app ───────────────────────────────
FROM node:20-alpine AS borrower-builder
ARG APP_VERSION
ENV VITE_APP_VERSION=$APP_VERSION
WORKDIR /app/borrower

COPY borrower/package*.json ./
RUN npm ci

COPY borrower/ ./
RUN npm test
RUN npm run build

# ── Stage 2: Python backend + built borrower app ──────────────────
FROM python:3.12-slim
ARG APP_VERSION
LABEL org.opencontainers.image.version=$APP_VERSION
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy the built borrower app into the backend's static folder
COPY --from=borrower-builder /app/borrower/dist ./static

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
