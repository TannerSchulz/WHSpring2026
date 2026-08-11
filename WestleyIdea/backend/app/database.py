from collections.abc import Generator
import struct
from threading import Lock

from azure.identity import DefaultAzureCredential
from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session, sessionmaker

from .config import get_database_settings


AZURE_SQL_TOKEN_SCOPE = "https://database.windows.net/.default"
SQL_COPT_SS_ACCESS_TOKEN = 1256

_engine: Engine | None = None
_engine_lock = Lock()
_session_factory: sessionmaker[Session] | None = None


def get_database_url(*, require_configured: bool = True) -> URL:
    settings = get_database_settings()
    if require_configured:
        settings.require_configured()

    return URL.create(
        "mssql+pyodbc",
        host=settings.server or "localhost",
        port=1433,
        database=settings.database or "MortgageAI",
        query={
            "driver": "ODBC Driver 18 for SQL Server",
            "Encrypt": "yes",
            "TrustServerCertificate": "no",
        },
    )


def _token_credential() -> DefaultAzureCredential:
    settings = get_database_settings()
    if settings.managed_identity_client_id:
        return DefaultAzureCredential(managed_identity_client_id=settings.managed_identity_client_id)
    return DefaultAzureCredential()


def create_database_engine() -> Engine:
    engine = create_engine(
        get_database_url(),
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
    )
    credential = _token_credential()

    @event.listens_for(engine, "do_connect")
    def provide_azure_sql_token(dialect, connection_record, connection_args, connection_params):  # noqa: ANN001, ARG001
        connection_args[0] = connection_args[0].replace(";Trusted_Connection=Yes", "")
        token = credential.get_token(AZURE_SQL_TOKEN_SCOPE).token.encode("utf-16-le")
        token_struct = struct.pack(f"<I{len(token)}s", len(token), token)
        connection_params["attrs_before"] = {SQL_COPT_SS_ACCESS_TOKEN: token_struct}

    return engine


def get_engine() -> Engine:
    global _engine, _session_factory
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = create_database_engine()
                _session_factory = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    return _engine


def get_session() -> Generator[Session, None, None]:
    get_engine()
    if _session_factory is None:
        raise RuntimeError("Database session factory was not initialized")

    with _session_factory() as session:
        yield session


def check_database_connection() -> None:
    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))
