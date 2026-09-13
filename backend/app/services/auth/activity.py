import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.user import User, UserActivity

logger = logging.getLogger("jandrishti.auth.activity")


def log_user_activity(
    db: Session,
    endpoint: str,
    method: str,
    user: Optional[User] = None,
    action: str = "api_request",
    status_code: Optional[int] = 200,
    ip_address: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[UserActivity]:
    """
    Record user activity in the PostgreSQL database.
    Safe execution: if logging encounters an issue, the user's API call is NEVER broken.
    """
    try:
        activity = UserActivity(
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            action=action,
            endpoint=endpoint,
            method=method.upper(),
            status_code=status_code,
            ip_address=ip_address,
            metadata_json=metadata or {}
        )
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return activity
    except Exception as exc:
        db.rollback()
        logger.warning(f"Failed to log user activity for {endpoint}: {exc}")
        return None


def get_user_activities(
    db: Session,
    user_id: Optional[int] = None,
    limit: int = 50
) -> List[UserActivity]:
    """
    Retrieve logged user activity records ordered by most recent.
    """
    query = db.query(UserActivity)
    if user_id is not None:
        query = query.filter(UserActivity.user_id == user_id)
    return query.order_by(UserActivity.id.desc()).limit(limit).all()
