from dataclasses import dataclass
import os


@dataclass(frozen=True)
class DatabaseSettings:
    server: str | None
    database: str | None
    managed_identity_client_id: str | None

    @property
    def configured(self) -> bool:
        return bool(self.server and self.database)

    def require_configured(self) -> None:
        missing = [
            name
            for name, value in (("SQL_SERVER", self.server), ("SQL_DATABASE", self.database))
            if not value
        ]
        if missing:
            raise RuntimeError(f"Missing required database configuration: {', '.join(missing)}")


def get_database_settings() -> DatabaseSettings:
    return DatabaseSettings(
        server=os.getenv("SQL_SERVER"),
        database=os.getenv("SQL_DATABASE"),
        managed_identity_client_id=os.getenv("AZURE_CLIENT_ID"),
    )


@dataclass(frozen=True)
class PortalSettings:
    api_key: str | None

    def require_api_key(self) -> str:
        if not self.api_key:
            raise RuntimeError("Missing required portal configuration: PORTAL_API_KEY")
        return self.api_key


def get_portal_settings() -> PortalSettings:
    return PortalSettings(api_key=os.getenv("PORTAL_API_KEY"))
