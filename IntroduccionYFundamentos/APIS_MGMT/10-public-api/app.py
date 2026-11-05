"""
Weather API (Starter)

Run it with:  fastapi dev app.py
Fill the blanks (_____) from top to bottom. The app starts once the decorator of /login is complete.
The other blanks only matter when a request reaches them, so you will notice them while testing.
"""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator

# Load the .env of this folder (next to .env.example); a variable set in the terminal wins
load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="Weather API")

# Same logger that fastapi dev uses, so errors show up in your terminal
logger = logging.getLogger("uvicorn.error")

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET_KEY") or secrets.token_hex(32)  # from env; random per run if unset
JWT_ALG = "HS256"
ACCESS_TOKEN_MINUTES = 15

# HTTPBearer reads "Authorization: Bearer <token>" and hands us the token.
# auto_error=False: if the header is missing we get None and return our own 401 message
# and WWW-Authenticate header (FastAPI's default is a generic "401 Not authenticated").
bearer = HTTPBearer(auto_error=False)

# In-memory database: {username: bcrypt hash}
users: dict[str, str] = {}

# OpenWeatherMap Configuration
# TODO: Get your free API key from https://openweathermap.org/api
# Hint: the environment variable is called OPENWEATHER_API_KEY (never paste the key in the code)
OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY")
GEOCODING_API_URL = "https://api.openweathermap.org/geo/1.0/direct"
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather"


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


def create_access_token(username: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": username, "iat": now, "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES)}
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)


def get_current_user(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> str:
    """Dependency: returns the username from the JWT, or answers 401 if it is missing, expired or invalid."""
    unauthorized = HTTPException(
        status_code=401,
        detail="Missing or invalid token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        claims = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG], options={"require": ["sub", "exp"]})
    except jwt.InvalidTokenError:  # expired, bad signature, malformed...
        raise unauthorized
    return claims["sub"]


# ============================================================================
# AUTHENTICATION ENDPOINTS (given here; explained in Exercise 11)
# ============================================================================

@app.post("/register", status_code=201)
def register(data: UserCreate) -> dict[str, str]:
    """Register a new user - Public endpoint"""
    if data.username in users:
        raise HTTPException(status_code=409, detail="User already exists")
    users[data.username] = hash_password(data.password)
    return {"message": "User registered successfully", "username": data.username}


# TODO: Which HTTP method sends credentials in a body?
# Hint: post (lowercase: @app.post)
@app.post("/login")
def login(data: Credentials) -> dict[str, str]:
    """Authenticate user and return JWT token - Public endpoint"""
    # Always run the bcrypt check, even for an unknown user, so timing does not reveal who exists
    password_ok = verify_password(data.password, users.get(data.username, DUMMY_HASH))
    if data.username not in users or not password_ok:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # TODO: Create the JWT access token
    # Hint: create_access_token(data.username) is defined above
    access_token = create_access_token(data.username)
    return {"message": "Login successful", "access_token": access_token, "token_type": "bearer"}


@app.get("/profile")
def profile(user: Annotated[str, Depends(get_current_user)]) -> dict[str, str]:
    """Get current user's profile - Protected endpoint (requires JWT)"""
    return {"username": user, "profile": f"Profile information for {user}"}


# ============================================================================
# EXTERNAL API CONSUMPTION - WEATHER ENDPOINT
# ============================================================================

@app.get("/weather")
def weather(
    city: Annotated[str, Query(min_length=1)],  # required: missing or empty answers 422
    country: Annotated[str, Query()] = "",
) -> dict[str, Any]:
    """
    Get weather information for a city - Public endpoint

    This endpoint demonstrates consuming MULTIPLE external APIs:
    1. OpenWeatherMap Geocoding API: Convert city name to coordinates
    2. OpenWeatherMap Current Weather API: Get weather by coordinates

    Query Parameters:
        city (str): City name (required)
        country (str): Optional ISO 3166 country code (e.g., 'ES', 'US')

    Note: this endpoint is PUBLIC (no JWT required) because the focus
    is on learning to consume external APIs, not authentication.
    """
    # Validate API key is configured
    if not OPENWEATHER_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OpenWeatherMap API key not configured: set OPENWEATHER_API_KEY in the .env file "
                   "(free key at https://openweathermap.org/api)",
        )

    # One client for both calls; always set a timeout on outbound calls
    with httpx.Client(timeout=10) as client:

        # ====================================================================
        # STEP 1: Get coordinates from city name using Geocoding API
        # ====================================================================

        # Format: "CityName,CountryCode" (country code is optional but recommended)
        query = f"{city},{country}" if country else city

        # Build the geocoding query parameters as a dict.
        # httpx URL-encodes every value, so "New York" or "Paris&limit=50" stay ONE parameter
        # (an f-string URL would let the user inject extra parameters).
        # TODO: Fill the geocoding query parameters (the query and the API key)
        # Hint: "q" is query, "appid" is OPENWEATHER_API_KEY
        geo_params = {"q": query, "appid": OPENWEATHER_API_KEY, "limit": 1}

        try:
            # TODO: Make the GET request to the geocoding API
            # Hint: client.get(GEOCODING_API_URL, params=geo_params)
            geo_response = client.get(GEOCODING_API_URL, params=geo_params)

            # 401 means OUR key is wrong or not active yet: a server misconfiguration, not an upstream failure
            if geo_response.status_code == 401:
                logger.error("OpenWeatherMap rejected the API key: check OPENWEATHER_API_KEY (new keys take up to 2 hours to activate)")
                raise HTTPException(status_code=503, detail="Weather service is not configured correctly")

            # Check if the request was successful
            # TODO: Which status code means success?
            # Hint: 200
            if geo_response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Geocoding API request failed (upstream status {geo_response.status_code})",
                )

            # TODO: Parse the JSON response from the geocoding API
            # Hint: geo_response.json()
            geo_data = geo_response.json()

            # Check if city was found
            if not geo_data:
                raise HTTPException(
                    status_code=404,
                    detail=f"Could not find coordinates for city: {city}. "
                           "Try adding a country code, e.g., ?city=Paris&country=FR",
                )

            # Extract coordinates and location info from the first result
            latitude = geo_data[0]["lat"]
            longitude = geo_data[0]["lon"]
            location_name = geo_data[0].get("name", city)
            location_country = geo_data[0].get("country", "Unknown")
            state = geo_data[0].get("state", "")  # Some locations have state info

        except httpx.HTTPError:
            # Never return str(e) to the client: it can contain the full URL, including the appid (API key).
            # Log the details server-side and send a generic message.
            logger.exception("Geocoding API request failed")
            raise HTTPException(status_code=502, detail="Could not connect to Geocoding API")
        except (KeyError, IndexError, ValueError):
            logger.exception("Invalid response from Geocoding API")
            raise HTTPException(status_code=502, detail="Unexpected response format from Geocoding API")

        # ====================================================================
        # STEP 2: Get weather data using coordinates
        # ====================================================================

        # TODO: Fill the weather query parameters (coordinates and API key)
        # Hint: "lat" is latitude, "lon" is longitude, "appid" is OPENWEATHER_API_KEY
        weather_params = {
            "lat": latitude,
            "lon": longitude,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric",
            "lang": "en",
        }

        try:
            # TODO: Make the GET request to the weather API
            # Hint: client.get(WEATHER_API_URL, params=weather_params)
            weather_response = client.get(WEATHER_API_URL, params=weather_params)

            if weather_response.status_code == 401:  # same rule as above: our key, our problem
                logger.error("OpenWeatherMap rejected the API key: check OPENWEATHER_API_KEY")
                raise HTTPException(status_code=503, detail="Weather service is not configured correctly")

            if weather_response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Weather API request failed (upstream status {weather_response.status_code})",
                )

            # TODO: Parse the JSON response from the weather API
            # Hint: weather_response.json()
            weather_data = weather_response.json()

            return {
                "location": {
                    "city": location_name,
                    "country": location_country,
                    "state": state,
                    "coordinates": {"latitude": latitude, "longitude": longitude},
                },
                "weather": {
                    "temperature": weather_data["main"]["temp"],
                    "feels_like": weather_data["main"]["feels_like"],
                    "humidity": weather_data["main"]["humidity"],
                    "pressure": weather_data["main"]["pressure"],
                    "description": weather_data["weather"][0]["description"],
                    "main": weather_data["weather"][0]["main"],
                    "icon": weather_data["weather"][0]["icon"],
                },
                "wind": {
                    "speed": weather_data["wind"]["speed"],
                    "direction": weather_data["wind"].get("deg", "N/A"),
                },
                "timestamp": weather_data["dt"],
            }

        except httpx.HTTPError:
            # Same rule as above: log server-side, never leak str(e) (it may contain the appid)
            logger.exception("Weather API request failed")
            raise HTTPException(status_code=502, detail="Could not connect to Weather API")
        except (KeyError, IndexError, ValueError):
            logger.exception("Invalid response from Weather API")
            raise HTTPException(status_code=502, detail="Unexpected response format from Weather API")