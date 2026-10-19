from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://d2skoyxe57scxh.cloudfront.net"

    # Database
    USE_MOCK_DB: bool = True
    AWS_REGION: str = "ap-southeast-2"
    DYNAMODB_TABLE_NAME: str = "AdaptiveBankingTransactions"
    DYNAMODB_POLICIES_TABLE: str = "AdaptiveBankingSecurityPolicies"
    DYNAMODB_VERIFICATIONS_TABLE: str = "AdaptiveBankingVerifications"
    DYNAMODB_SCHEDULED_TABLE: str = "AdaptiveBankingScheduled"
    DYNAMODB_NOTIFICATIONS_TABLE: str = "AdaptiveBankingNotifications"
    DYNAMODB_AUDIT_TABLE: str = "AdaptiveBankingAuditLogs"
    DYNAMODB_ENDPOINT_URL: str | None = None

    # Asynchronous Queues & Alerts
    SQS_QUEUE_URL: str | None = None
    SNS_TOPIC_ARN: str | None = None

    # Cognito
    COGNITO_USER_POOL_ID: str = "ap-southeast-2_YiskHVZ1k"
    COGNITO_APP_CLIENT_ID: str = "1lvft401ciiha7t0fl47nfgutf"
    COGNITO_REGION: str = "ap-southeast-2"
    REQUIRE_AUTH: bool = False
    JWT_SECRET: str = "adaptive-banking-security-jwt-secret-2026"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
