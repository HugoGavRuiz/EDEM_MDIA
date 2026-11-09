FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1

# Primero las dependencias (se cachean mientras no cambien), después el código.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app

# Usuario sin privilegios: el contenedor no corre como root.
RUN useradd --system --no-create-home api
USER api

EXPOSE 8000
# Aplica las migraciones pendientes y arranca la API.
CMD ["sh", "-c", "/app/.venv/bin/alembic upgrade head && exec /app/.venv/bin/uvicorn app.main:crear_app --factory --host 0.0.0.0 --port 8000"]
