from __future__ import annotations

import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import close_mongo, connect_mongo, ensure_indexes
from app.core.logging import configure_logging
from app.routers import account, admin, auth, billing, claims, guest, ops, proof, support, verify, waitlist, well_known


def create_app() -> FastAPI:
    app = FastAPI(title="MiraTrust.AI", version="0.1.0")

    configure_logging(settings.log_level)

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(int((time.perf_counter() - start) * 1000))
        return response

    origins = settings.cors_origins_list
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"] ,
            allow_headers=["*"],
        )

    @app.on_event("startup")
    async def _startup() -> None:
        await connect_mongo()
        await ensure_indexes()

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        await close_mongo()

    @app.get("/health")
    async def health() -> dict:
        return {"ok": True}

    app.include_router(auth.router)
    app.include_router(account.router)
    app.include_router(claims.router)
    app.include_router(verify.router)
    app.include_router(proof.router)
    app.include_router(billing.router)
    app.include_router(ops.router)
    app.include_router(guest.router)
    app.include_router(waitlist.router)
    app.include_router(support.router)
    app.include_router(admin.router)
    app.include_router(well_known.router)

    return app


app = create_app()
