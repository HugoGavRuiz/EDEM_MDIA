"""
Users API with Basic Auth (Starter)

Run it with:  fastapi dev app.py
Fill the blanks (_____) from top to bottom; the app starts once the POST decorator and the Depends(...) of get_users are complete.
"""

from typing import Annotated

import bcrypt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field, field_validator

app = FastAPI(title="Users API")

# HTTPBasic reads the Authorization header and decodes username and password.
# If the header is missing it already answers 401 with WWW-Authenticate.
security = HTTPBasic(realm="Authentication Required")

# In-memory database: {username: bcrypt hash}
users: dict[str, str] = {}


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


def get_current_user(creds: Annotated[HTTPBasicCredentials, Depends(security)]) -> str:
    """Dependency: returns the username, or answers 401 if the credentials are wrong."""
    username = creds.username if creds.username in users else None
    # Always run the bcrypt check, even for an unknown user, so timing does not reveal who exists
    password_ok = verify_password(creds.password, users[username] if username else DUMMY_HASH)
    if username is None or not password_ok:
        # TODO: Which header tells the client what kind of authentication the server expects?
        # Hint: WWW-Authenticate (the 401 response carries it, with the value 'Basic realm="..."')
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": 'Basic realm="Authentication Required"'},
        )
    return username


# TODO: Which method CREATES a user?
# Hint: post (lowercase: @app.post)
@app.post("/users", status_code=201)
def register_user(data: UserCreate) -> dict[str, str]:
    if data.username in users:
        raise HTTPException(status_code=409, detail="User already exists")
    users[data.username] = hash_password(data.password)
    return {"message": "User registered successfully", "username": data.username}


# TODO: Protect this route: which dependency checks the credentials and gives us the user?
# Hint: get_current_user, defined above. Depends() takes the function itself, without ()
@app.get("/users")
def get_users(user: Annotated[str, Depends(get_current_user)]) -> dict[str, list[str]]:
    return {"users": list(users)}