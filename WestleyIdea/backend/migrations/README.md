# Database migrations

Run migrations from the backend image before starting a new API revision:

```bash
alembic upgrade head
```

The command reads `SQL_SERVER` and `SQL_DATABASE` and authenticates to Azure SQL using the container's managed identity. Application startup never runs migrations automatically.
