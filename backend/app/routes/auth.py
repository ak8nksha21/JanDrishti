import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserOut,
    TokenResponse,
    MessageResponse,
    UserActivityOut
)
from app.services.auth.security import (
    hash_password,
    verify_password,
    create_access_token
)
from app.services.auth.dependencies import (
    get_current_user,
    get_optional_current_user
)
from app.services.auth.activity import (
    log_user_activity,
    get_user_activities
)

logger = logging.getLogger("jandrishti.routes.auth")

router = APIRouter(tags=["Authentication"])


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account"
)
def signup(
    user_in: UserCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Register a new user account. Passwords are securely hashed with bcrypt.
    Authentication is optional and does not restrict public access.
    """
    normalized_email = user_in.email.strip().lower()
    clean_name = user_in.name.strip()

    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name cannot be blank."
        )

    # Check for existing account
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Securely hash password
    hashed_pwd = hash_password(user_in.password)

    new_user = User(
        name=clean_name,
        email=normalized_email,
        password_hash=hashed_pwd,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        last_login_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create JWT session token
    token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email,
        "name": new_user.name
    })

    # Record activity
    client_ip = request.client.host if request.client else None
    log_user_activity(
        db=db,
        endpoint="/api/auth/signup",
        method="POST",
        user=new_user,
        action="user_signup",
        status_code=201,
        ip_address=client_ip,
        metadata={"email": new_user.email}
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(new_user)
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Log in to existing user account"
)
def login(
    credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Authenticate an existing user by email and password.
    Returns a Bearer token establishing user identity.
    """
    normalized_email = credentials.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "name": user.name
    })

    client_ip = request.client.host if request.client else None
    log_user_activity(
        db=db,
        endpoint="/api/auth/login",
        method="POST",
        user=user,
        action="user_login",
        status_code=200,
        ip_address=client_ip
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Log out of user session"
)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    optional_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Log out the current user. Client clears stored token from local storage.
    """
    if optional_user:
        client_ip = request.client.host if request.client else None
        log_user_activity(
            db=db,
            endpoint="/api/auth/logout",
            method="POST",
            user=optional_user,
            action="user_logout",
            status_code=200,
            ip_address=client_ip
        )
    return MessageResponse(message="Successfully logged out.")


@router.get(
    "/me",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile"
)
def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve profile details of the currently authenticated user.
    Requires a valid Bearer token.
    """
    return UserOut.model_validate(current_user)


@router.get(
    "/activity",
    response_model=List[UserActivityOut],
    status_code=status.HTTP_200_OK,
    summary="Get current user activity history"
)
def get_my_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve activity history for the currently logged-in user.
    """
    activities = get_user_activities(db=db, user_id=current_user.id, limit=50)
    return [
        UserActivityOut(
            id=a.id,
            user_id=a.user_id,
            user_email=a.user_email,
            action=a.action,
            endpoint=a.endpoint,
            method=a.method,
            status_code=a.status_code,
            ip_address=a.ip_address,
            metadata=a.metadata_json or {},
            created_at=a.created_at
        )
        for a in activities
    ]
