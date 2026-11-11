"""
JWT Authentication API (Starter)

Run it with:  fastapi dev app.py
Fill the blanks (_____) from top to bottom. The app starts once the decorator of /refresh
and the Depends(...) of /profile are complete. The other blanks only matter when a request
reaches them, so you will notice them while testing.
"""

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator

# Load the .env of this folder (next to .env.example); a variable set in the terminal wins
load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="JWT Authentication API")

# JWT Configuration
# The secret comes from the environment. If it is not set, a random one is
# generated on every start (tokens stop working after a restart).
JWT_SECRET = os.environ.get("JWT_SECRET_KEY") or secrets.token_hex(32)  # from env; random per run if unset
JWT_ALG = "HS256"  # TODO: Which signing algorithm? (HMAC with SHA-256)
# Hint: HS256

# Short-lived access tokens + longer-lived refresh tokens
ACCESS_TOKEN_MINUTES = 15
REFRESH_TOKEN_DAYS = 1

# Issuer (iss = who created the token) and audience (aud = who the token is for)
# We write both into every token we create and REQUIRE both on every token we receive
JWT_ISSUER = "notes-api"
JWT_AUDIENCE = "notes-client"

# HTTPBearer reads "Authorization: Bearer <token>" and hands us the token.
# auto_error=False: if the header is missing we get None and return our own 401 message
# and WWW-Authenticate header (FastAPI's default is a generic "401 Not authenticated").
bearer = HTTPBearer(auto_error=False)

# In-memory database: {username: bcrypt hash}
users: dict[str, str] = {}

# Revoked tokens (by their unique id, the "jti" claim).
# In memory for this exercise: it is lost on restart. Use Redis or a DB in production.
revoked: set[str] = set()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:  # bcrypt only accepts passwords of up to 72 bytes
        return False


# Compared against when the user does not exist, so both failures take the same time
DUMMY_HASH = hash_password("not-a-real-password")


class UserCreate(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, pw: str) -> str:
        if len(pw.encode()) > 72:  # bcrypt counts bytes, not characters
            raise ValueError("password must be at most 72 bytes")
        return pw


class Credentials(BaseModel):
    # Plain str: wrong credentials must answer 401, never 422
    username: str
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(TokenPair):
    message: str
    expires_in: int


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})  # TODO: Which header tells the client how to authenticate?
    # Hint: WWW-Authenticate


def create_token(username: str, token_type: str, lifetime: timedelta) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": username,
        "iat": now,
        "exp": now + lifetime,  # TODO: Which claim says when the token expires?
        # Hint: exp
        "iss": JWT_ISSUER,  # TODO: Which claim says WHO created the token?
        # Hint: iss
        "aud": JWT_AUDIENCE,  # TODO: Which claim says WHO the token is for?
        # Hint: aud
        "jti": str(uuid.uuid4()),  # TODO: Which claim is the unique id of the token?
        # Hint: jti (JWT ID)
        "type": token_type,
    }
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)


def create_access_token(username: str) -> str:
    return create_token(username, "access", timedelta(minutes=ACCESS_TOKEN_MINUTES))


def create_refresh_token(username: str) -> str:
    return create_token(username, "refresh", timedelta(days=REFRESH_TOKEN_DAYS))


def decode_token(token: str, expected_type: str | None) -> dict:
    """Check signature, exp, iss, aud, type and revocation. expected_type None accepts any type."""
    try:
        claims = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALG],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"require": ["sub", "exp", "iss", "aud", "jti", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise unauthorized("Token has expired")
    except jwt.InvalidTokenError:  # bad signature, wrong iss or aud, malformed...
        raise unauthorized("Invalid token")
    if expected_type is not None and claims["type"] != expected_type:  # TODO: Which claim says access or refresh?
        # Hint: type
        raise unauthorized(f"Wrong token type: expected {expected_type}")
    if claims["jti"] in revoked:  # TODO: Which set holds the revoked token ids?
        # Hint: revoked
        raise unauthorized("Token has been revoked")
    return claims


def get_token(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> str:
    """Dependency: returns the raw token, or answers 401 if there is no Bearer header."""
    if creds is None:
        raise unauthorized("Missing or invalid token")
    return creds.credentials


def get_current_user(token: Annotated[str, Depends(get_token)]) -> str:
    """Dependency: returns the username from an ACCESS token (refresh tokens are rejected)."""
    return decode_token(token, "access")["sub"]


# ============================================================================
# PUBLIC ENDPOINTS (No authentication required)
# ============================================================================

@app.post("/register", status_code=201)
def register(data: UserCreate) -> dict[str, str]:
    """Register a new user - Public endpoint"""
    if data.username in users:
        raise HTTPException(status_code=409, detail="User already exists")
    # Hash the password before storing it
    users[data.username] = hash_password(data.password)
    return {"message": "User registered successfully", "username": data.username}


@app.post("/login")
def login(data: Credentials) -> LoginResponse:
    """
    Authenticate user and return JWT tokens - Public endpoint

    This is the KEY difference from Basic Auth:
    - User sends username/password ONCE in the request body
    - Server validates credentials and returns an access token + a refresh token
    - Client sends the access token with every request (valid 15 minutes)
    - When it expires, the client uses the refresh token on POST /refresh
    """
    # TODO: Check against a dummy hash if the user is unknown
    # Hint: DUMMY_HASH
    # Always run the bcrypt check, even for an unknown user, so timing does not reveal who exists
    password_ok = verify_password(data.password, users.get(data.username, DUMMY_HASH))
    if data.username not in users or not password_ok:
        raise unauthorized("Invalid credentials")
    return LoginResponse(
        message="Login successful",
        access_token=create_access_token(data.username),  # TODO: Create the access token
        # Hint: create_access_token
        refresh_token=create_refresh_token(data.username),  # TODO: Create the refresh token
        # Hint: create_refresh_token
        expires_in=ACCESS_TOKEN_MINUTES * 60,
    )


# ============================================================================
# TOKEN MANAGEMENT ENDPOINTS
# ============================================================================

# TODO: Which HTTP method? (it creates a new token)
# Hint: post (lowercase: @app.post)
@app.post("/refresh")
def refresh(token: Annotated[str, Depends(get_token)]) -> dict[str, str | int]:
    """
    Get a new access token - Requires a REFRESH token

    Authorization: Bearer <refresh_token>
    An access token is rejected here, and a refresh token is rejected everywhere else.
    """
    claims = decode_token(token, "refresh")  # TODO: Accept ONLY refresh tokens here
    # Hint: refresh
    return {
        "access_token": create_access_token(claims["sub"]),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
    }


@app.post("/logout")
def logout(token: Annotated[str, Depends(get_token)]) -> dict[str, str]:
    """
    Revoke the token sent in the Authorization header - Requires any valid token

    Call it once with the access token and once with the refresh token
    to fully log out.
    """
    claims = decode_token(token, None)  # None: access OR refresh
    revoked.add(claims["jti"])
    return {"message": f"{claims['type'].capitalize()} token revoked"}


# ============================================================================
# PROTECTED ENDPOINTS (access token required)
# ============================================================================

@app.get("/profile")  # TODO: Protect it with the dependency that returns the user from an ACCESS token
# Hint: get_current_user, defined above. Depends() takes the function itself, without ()
def profile(user: Annotated[str, Depends(get_current_user)]) -> dict[str, str]:
    """
    Get current user's profile - Protected endpoint

    This endpoint requires a valid access token in the Authorization header:
    Authorization: Bearer <token>
    """
    # In a real application, you would fetch user data from a database
    return {
        "username": user,
        "profile": f"Profile information for {user}",
        "account_created": "2025-01-01",  # Example data
    }


@app.get("/users")
def get_users(user: Annotated[str, Depends(get_current_user)]) -> dict[str, object]:
    """
    Get list of all users - Protected endpoint

    Requires a valid access token to access this resource.
    """
    return {"users": list(users), "requested_by": user}


@app.get("/protected")
def protected(user: Annotated[str, Depends(get_current_user)]) -> dict[str, str]:
    """
    Example protected endpoint - Requires JWT

    This demonstrates that ANY endpoint can be protected with Depends(get_current_user)
    """
    return {
        "message": f"Hello {user}, you have access to this protected resource!",
        "tip": "This endpoint can only be accessed with a valid JWT token",
    }