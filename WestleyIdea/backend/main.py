import os
import time
from datetime import datetime

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import get_database_settings
from app.database import check_database_connection
from app.portal import router as portal_router
from app.public import router as public_router

load_dotenv()

app = FastAPI(title="MortgageAI API")
app.include_router(portal_router)
app.include_router(public_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Live mortgage rates (Freddie Mac PMMS public weekly survey; no API key).
# These are national conventional benchmarks, not location- or program-specific quotes.
PMMS_URL = "https://www.freddiemac.com/pmms/docs/PMMS_history.csv"
RATES_CACHE_TTL = 6 * 60 * 60

_rates_cache: dict = {"data": None, "fetched_at": 0.0}


class UtahRatesResponse(BaseModel):
    rate_30yr: float
    rate_15yr: float
    as_of: str
    source: str
    live: bool


async def get_live_rates() -> UtahRatesResponse:
    now = time.time()
    if _rates_cache["data"] is not None and now - _rates_cache["fetched_at"] < RATES_CACHE_TTL:
        return _rates_cache["data"]

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(PMMS_URL)
            response.raise_for_status()

        # CSV columns: date,pmms30,pmms30p,pmms15,pmms15p,...
        # Walk backwards to the most recent week that has both 30- and 15-year rates.
        for line in reversed(response.text.strip().splitlines()):
            parts = line.split(",")
            if len(parts) < 4 or not parts[1].strip() or not parts[3].strip():
                continue
            try:
                rate_30 = float(parts[1])
                rate_15 = float(parts[3])
                month, day, year = (int(value) for value in parts[0].split("/"))
            except ValueError:
                continue

            result = UtahRatesResponse(
                rate_30yr=rate_30,
                rate_15yr=rate_15,
                as_of=f"{datetime(year, month, day):%b} {day}, {year}",
                source="Freddie Mac Primary Mortgage Market Survey",
                live=True,
            )
            _rates_cache["data"] = result
            _rates_cache["fetched_at"] = now
            return result

        raise ValueError("no parsable PMMS rows")
    except Exception:
        return UtahRatesResponse(
            rate_30yr=6.4,
            rate_15yr=5.8,
            as_of="fallback planning estimate",
            source="Static estimate - live rate feed unavailable",
            live=False,
        )


@app.get("/api/utah-rates", response_model=UtahRatesResponse)
async def utah_rates():
    return await get_live_rates()


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "database_configured": get_database_settings().configured,
    }


@app.get("/api/health/database")
def database_health():
    if not get_database_settings().configured:
        raise HTTPException(status_code=503, detail="Database is not configured")

    try:
        check_database_connection()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Database connection failed") from error

    return {"status": "ok"}


# Optional local static frontend support. Production frontends run in separate containers.
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))
