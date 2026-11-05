"""
API Key Auth (Starter)

Run it with:  fastapi dev app.py
Fill the blanks (_____) from top to bottom. The app starts once three of them are complete:
auto_error of APIKeyHeader, the decorator of /api-key/rotate and the Depends(...) of get_users.
The other blanks only matter when a request reaches them, so you will notice them while testing.
"""

import hashlib
import hmac
import secrets
from typing import Annotated

import bcrypt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import APIKeyHeader, HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field, field_validator

app = FastAPI(title="API Key Auth")

# APIKeyHeader reads the X-API-Key header and hands its value to our dependency.
# auto_error=False lets us return our own 401 message and WWW-Authenticate header
# (FastAPI's default is a generic 401 Not authenticated).
# TODO: Which header carries the key, and which value turns the automatic error off?
# Hint: the header is X-API-Key; auto_error takes a boolean
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# HTTPBasic (as in Exercise 08) is used only to rotate or revoke a key:
# your username and password prove who you are even if you lost the key.
basic = HTTPBasic(realm="Authentication Required")

# Recognisable prefix for our keys ("sk_" = secret key).
# Secret scanners (GitHub, GitLab, gitleaks...) search for known prefixes,
# so a leaked key is easier to detect automatically.
API_KEY_PREFIX = "sk_"

# In-memory database: {username: {"password": bcrypt hash, "api_key_hash": SHA-256 hex or None}}
# We NEVER store the API key itself, only its SHA-256 hash (None once revoked).
users: dict[str, dict[str, str | None]] = {}


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
    # HTTP Basic sends "username:password" as ASCII: printable ASCII only, and no spaces or ':' in the username
    username: str = Field(min_length=1, max_length=32, pattern=r"^[\x21-\x39\x3b-\x7e]+$")
    password: str = Field(min_length=8, max_length=72, pattern=r"^[\x20-\x7e]+$")

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, pw: str) -> str:
        if len(pw.encode()) > 72:  # bcrypt counts bytes, not characters
            raise ValueError("password must be at most 72 bytes")
        return pw


# ============================================================================
# API KEY HELPERS (generate, hash, look up)
# ============================================================================

def generate_api_key() -> str:
    """Generate a new random API key (about 256 bits of entropy)."""
    # TODO: Generate a cryptographically secure, URL-safe random string of 32 bytes
    # Hint: secrets.token_urlsafe(32)  (do NOT use uuid4 or random for secrets)
    return API_KEY_PREFIX + secrets.token_urlsafe(32)


def hash_api_key(key: str) -> str:
    """
    Hash an API key with SHA-256.

    A fast hash is fine here because the key is long and random: there is
    nothing to guess. Passwords are short and human-chosen, so they need a
    slow, salted hash (bcrypt) instead.
    """
    # TODO: Hash the key with SHA-256 and return it as a hex string
    # Hint: hashlib.sha256(...).hexdigest()
    return hashlib.sha256(key.encode()).hexdigest()


def find_user_by_api_key(api_key: str) -> str | None:
    """Return the username that owns this API key, or None."""
    candidate_hash = hash_api_key(api_key)

    for username, user_data in users.items():
        stored_hash = user_data["api_key_hash"]
        # Constant-time comparison: takes the same time whether the first
        # character differs or the last one does
        # TODO: Compare the hashes in constant time (never use == for secrets)
        # Hint: hmac.compare_digest(a, b) takes the same time wherever a and b differ
        if stored_hash and hmac.compare_digest(stored_hash, candidate_hash):
            return username

    return None


# ============================================================================
# DEPENDENCIES (API key for normal requests, Basic Auth for rotate and revoke)
# ============================================================================

def get_current_user(api_key: Annotated[str | None, Depends(api_key_header)]) -> str:
    """Dependency: returns the username that owns the key, or answers 401."""
    if api_key is None:
        # TODO: Which status code means "you are not authenticated"?
        # Hint: 401 (the invalid-key case below uses the same one, plus WWW-Authenticate: ApiKey)
        # "ApiKey" is not an IANA-registered WWW-Authenticate scheme (nor is FastAPI's "APIKey"); fine for teaching
        raise HTTPException(
            status_code=401,
            detail="API key missing: include the X-API-Key header",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    username = find_user_by_api_key(api_key)
    if username is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return username


def get_basic_user(creds: Annotated[HTTPBasicCredentials, Depends(basic)]) -> str:
    """Dependency: returns the username if username and password are right, or answers 401."""
    username = creds.username if creds.username in users else None
    # Always run the bcrypt check, even for an unknown user, so timing does not reveal who exists
    stored = users[username]["password"] if username else DUMMY_HASH
    password_ok = verify_password(creds.password, stored)
    if username is None or not password_ok:
        # TODO: Which header tells the client what kind of authentication the server expects?
        # Hint: WWW-Authenticate (the 401 response carries it, with the value 'Basic realm="..."')
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": 'Basic realm="Authentication Required"'},
        )
    return username


# ============================================================================
# PUBLIC ENDPOINT (no authentication required)
# ============================================================================

@app.post("/register", status_code=201)
def register(data: UserCreate) -> dict[str, str]:
    """Register a new user and return their API key (ONCE)."""
    if data.username in users:
        raise HTTPException(status_code=409, detail="User already exists")

    api_key = generate_api_key()

    # Store the password hash and the HASH of the API key
    users[data.username] = {
        "password": hash_password(data.password),
        "api_key_hash": hash_api_key(api_key),
    }

    # This is the only time the plain key is shown
    return {
        "message": "User registered successfully",
        "username": data.username,
        "api_key": api_key,
        "warning": "Store this API key now. It will not be shown again.",
    }


# ============================================================================
# BASIC AUTH PROTECTED ENDPOINTS (key rotation and revocation)
# ============================================================================

# TODO: Which method CREATES something new (a new key on every call)?
# Hint: post (lowercase: @app.post)
@app.post("/api-key/rotate")
def rotate_api_key(user: Annotated[str, Depends(get_basic_user)]) -> dict[str, str]:
    """
    Issue a new API key and invalidate the old one. Protected by Basic Auth.

    Use it if you lost your key, if it leaked, or as routine rotation.
    The server cannot "recover" a key: it only has its hash.
    """
    new_api_key = generate_api_key()

    # Overwriting the stored hash invalidates the old key immediately
    users[user]["api_key_hash"] = hash_api_key(new_api_key)

    return {
        "message": "API key rotated. The previous key no longer works.",
        "username": user,
        "api_key": new_api_key,
        "warning": "Store this API key now. It will not be shown again.",
    }


@app.delete("/api-key")
def revoke_api_key(user: Annotated[str, Depends(get_basic_user)]) -> dict[str, str]:
    """Revoke the current API key without issuing a new one. Protected by Basic Auth."""
    users[user]["api_key_hash"] = None
    return {
        "message": "API key revoked. Use POST /api-key/rotate to get a new one.",
        "username": user,
    }


# ============================================================================
# API KEY PROTECTED ENDPOINT (the main pattern to learn)
# ============================================================================

# TODO: Protect this route: which dependency reads the key and gives us the user?
# Hint: get_current_user, defined above. Depends() takes the function itself, without ()
@app.get("/users")
def get_users(user: Annotated[str, Depends(get_current_user)]) -> dict[str, object]:
    """List all users. Clients must send a valid X-API-Key header."""
    return {"users": list(users), "count": len(users)}