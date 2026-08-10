ARG APP_VERSION=dev

# Build and test the borrower React application.
FROM node:20-alpine AS borrower-builder
ARG APP_VERSION
ENV VITE_APP_VERSION=$APP_VERSION
WORKDIR /app/borrower

COPY borrower/package*.json ./
RUN npm ci

COPY borrower/ ./
RUN npm test
RUN npm run build

# Package the FastAPI service and compiled borrower application together.
FROM python:3.12-slim AS runner
ARG APP_VERSION
LABEL org.opencontainers.image.title="MortgageAI Borrower"
LABEL org.opencontainers.image.version=$APP_VERSION
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=borrower-builder /app/borrower/dist ./static

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
