"""
ACIS — Autonomous AI Cost Intelligence System
Main application entry point.

"The Stripe for AI usage optimization."
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog
import uvicorn

from app.api.routes import router
from config.settings import get_settings

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="ACIS — AI Cost Intelligence System",
        description=(
            "Autonomous AI cost optimization. Route prompts to the best model "
            "for cost × quality × speed. Simulate before you spend. "
            "Self-learning routing that improves over time."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS for dashboard
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount routes
    app.include_router(router, prefix="/api/v1", tags=["ACIS"])

    @app.get("/")
    async def root():
        return {
            "name": "ACIS — AI Cost Intelligence System",
            "version": "1.0.0",
            "tagline": "The Stripe for AI usage optimization",
            "docs": "/docs",
            "dashboard": "/dashboard",
        }

    return app


app = create_app()

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.app_port,
        reload=settings.app_env == "development",
    )
