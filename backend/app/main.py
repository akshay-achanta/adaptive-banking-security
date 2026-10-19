import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routes import health, dashboard, transactions, auth_routes, analytics, security_workflow

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("adaptive_banking")

settings = get_settings()

app = FastAPI(
    title="Adaptive Banking Security API",
    description=(
        "Adaptive Banking Security telemetry, machine learning intelligence, "
        "policy workflow engine, and DynamoDB audit trail.\n\n"
        "### Authentication\n"
        "Protected endpoints require an AWS Cognito JWT Bearer token (ID token or Access token) "
        "issued by the Cognito User Pool (`ap-southeast-2_YiskHVZ1k`).\n"
        "Click the **Authorize** button at the top right to authenticate in Swagger UI."
    ),
    version="1.3.0",
)

# Setup CORS
origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ENVIRONMENT == "development" else origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please verify backend logs."},
    )


# Include Routers
app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(auth_routes.router)
app.include_router(analytics.router)
app.include_router(security_workflow.router)


@app.get("/")
async def root():
    return {
        "message": "Adaptive Banking Security API is running",
        "health_check": "/health",
        "documentation": "/docs",
        "environment": settings.ENVIRONMENT,
        "intelligence_layer": "scikit-learn active",
        "workflow_engine": "Day 3 Security & Workflow Engine active",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
