import logging
from app.config import get_settings
from app.db.base import BaseRepository
from app.db.memory import InMemoryRepository

logger = logging.getLogger("adaptive_banking.db")

_repo_instance: BaseRepository | None = None


def get_repository() -> BaseRepository:
    global _repo_instance
    if _repo_instance is not None:
        return _repo_instance

    settings = get_settings()
    if settings.USE_MOCK_DB:
        logger.info("Database initialized in LOCAL MOCK MODE (in-memory)")
        _repo_instance = InMemoryRepository()
        return _repo_instance

    try:
        from app.db.dynamodb import DynamoDBRepository
        logger.info("Initializing AWS DynamoDB repository for table: %s (region: %s)",
                    settings.DYNAMODB_TABLE_NAME, settings.AWS_REGION)
        _repo_instance = DynamoDBRepository()
    except Exception as e:
        logger.warning(
            "Failed to initialize AWS DynamoDB (%s). Falling back gracefully to LOCAL MOCK MODE.", e
        )
        _repo_instance = InMemoryRepository()

    return _repo_instance
