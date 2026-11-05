"""
Notes API - Pagination (Starter)

Run it with:  fastapi dev app.py
Fill the blanks (_____) from top to bottom; the app starts once the GET decorator and the ge= and le= of the limit are complete.
"""

import base64
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI(title="Notes API")


class NoteCreate(BaseModel):
    title: str = Field(min_length=1)
    content: str = ""


# PATCH: every field is optional; only the ones the client sends are changed
class NoteUpdate(BaseModel):
    title: str | None = Field(None, min_length=1)
    content: str | None = None

    # Runs after the fields are validated: an empty body (or only nulls) is a 422
    @model_validator(mode="after")
    def at_least_one_field(self):
        if self.title is None and self.content is None:
            raise ValueError("Send at least one of: title, content")
        return self


class Note(BaseModel):
    id: int
    title: str
    content: str
    created_at: str
    updated_at: str


# The "page" object differs per mode, so there is one model for each
class OffsetPage(BaseModel):
    mode: Literal["offset"]
    offset: int
    limit: int
    total: int
    next: str | None
    prev: str | None


class CursorPage(BaseModel):
    mode: Literal["cursor"]
    limit: int
    next_cursor: str | None
    next: str | None
    prev: str | None


class OffsetNoteList(BaseModel):
    data: list[Note]
    page: OffsetPage


class CursorNoteList(BaseModel):
    data: list[Note]
    page: CursorPage


# In-memory data store. Everything is lost when the app restarts.
notes: dict[int, Note] = {}
next_id = 1


def now_iso() -> str:
    """Current time in ISO 8601, UTC (e.g. '2026-10-26T09:30:00Z')."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def add_note(title: str, content: str = "", timestamp: str | None = None) -> Note:
    """Store a new note and return it. The server assigns id and timestamps."""
    global next_id
    timestamp = timestamp or now_iso()
    note = Note(id=next_id, title=title, content=content, created_at=timestamp, updated_at=timestamp)
    notes[note.id] = note
    next_id += 1
    return note


def seed_notes(total: int) -> None:
    """Create `total` notes (ids 1..total), one minute apart, so there is data to paginate."""
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(1, total + 1):
        created = (start + timedelta(minutes=i)).isoformat().replace("+00:00", "Z")
        add_note(f"Note {i}", f"Seed note number {i}", timestamp=created)


seed_notes(95)


# ---------------------------------------------------------------------------
# Errors: RFC 9457 "problem details" (same helper and handlers as exercise 05)
# ---------------------------------------------------------------------------

def problem(request: Request, status: int, title: str, detail: str, **extra) -> JSONResponse:
    """RFC 9457 problem details: one error format for the whole API."""
    body = {"type": "about:blank", "title": title, "status": status, "detail": detail,
            "instance": request.url.path, **extra}
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


# Starlette raises the same HTTPException class for unknown URLs (404) and wrong methods (405),
# so registering the handler for it covers our own errors and the router's.
@app.exception_handler(StarletteHTTPException)
def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    response = problem(request, exc.status_code, HTTPStatus(exc.status_code).phrase, str(exc.detail))
    response.headers.update(exc.headers or {})
    return response


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return problem(request, 422, "Unprocessable Content", "Request body or parameters are invalid.",
                   errors=jsonable_encoder(exc.errors()))


def get_or_404(note_id: int) -> Note:
    if note_id not in notes:
        raise HTTPException(status_code=404, detail=f"Note {note_id} does not exist.")
    return notes[note_id]


# ---------------------------------------------------------------------------
# Pagination helpers
# ---------------------------------------------------------------------------

def encode_cursor(note_id: int) -> str:
    """Opaque cursor: base64 (URL-safe, without '=' padding) of the last id the client has seen."""
    # TODO: Encode the id as URL-safe base64 (the result is then cut so it has no "=" padding)
    # Hint: urlsafe_b64encode
    return base64.urlsafe_b64encode(str(note_id).encode()).decode().rstrip("=")  # 91 -> "OTE"


def decode_cursor(cursor: str) -> int:
    """Return the id inside the cursor; a cursor that is not one of ours is a 400."""
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded).decode("ascii")
    except ValueError:  # bad base64 or non-ASCII content
        raw = ""
    if not raw.isdigit():
        raise HTTPException(status_code=400,
                            detail="The cursor is not valid. Use the next_cursor value from a previous response.")
    return int(raw)


def page_url(request: Request, **params) -> str:
    """Absolute URL to /notes with the given query parameters."""
    return str(request.url_for("list_notes").include_query_params(**params))


def link_header(next_url: str | None, prev_url: str | None) -> str | None:
    """RFC 8288 Link header with the same next/prev URLs that are in the body."""
    links = []
    # TODO: Set the link relation types (RFC 8288)
    # Hint: 'next' and 'prev'
    if next_url:
        links.append(f'<{next_url}>; rel="next"')
    if prev_url:
        links.append(f'<{prev_url}>; rel="prev"')
    return ", ".join(links) or None


def offset_page(request: Request, ordered: list[Note], offset: int, limit: int) -> OffsetNoteList:
    """?offset=N&limit=M: skip N notes, return the next M. Simple, but shifts when data changes."""
    total = len(ordered)
    # TODO: Skip `offset` notes and take the next `limit` ones (list slicing)
    # Hint: ordered[offset:offset + limit]
    data = ordered[offset:offset + limit]
    next_url = page_url(request, offset=offset + limit, limit=limit) if offset + limit < total else None
    # min(offset, total): an offset past the end still gets a prev that points at the last real page
    prev_url = page_url(request, offset=max(min(offset, total) - limit, 0), limit=limit) if offset > 0 else None
    return OffsetNoteList(data=data, page=OffsetPage(mode="offset", offset=offset, limit=limit, total=total,
                                                     next=next_url, prev=prev_url))


def cursor_page(request: Request, ordered: list[Note], cursor: str | None, limit: int) -> CursorNoteList:
    """?cursor=X&limit=M: return the M notes that come right after the note inside the cursor."""
    remaining = ordered  # no cursor: first page
    if cursor is not None:
        after_id = decode_cursor(cursor)
        # Newest first: the notes that come "after" a note are the ones with a smaller id
        remaining = [note for note in ordered if note.id < after_id]

    data = remaining[:limit]
    next_cursor = encode_cursor(data[-1].id) if len(remaining) > limit else None  # the LAST note of this page
    next_url = page_url(request, cursor=next_cursor, limit=limit) if next_cursor else None
    # prev is always None: forward-only. To go back, the client reuses a cursor it already has
    # TODO: Name the field that holds the cursor for the next page
    # Hint: next_cursor
    return CursorNoteList(data=data, page=CursorPage(mode="cursor", limit=limit, next_cursor=next_cursor,
                                                     next=next_url, prev=None))


# ---------------------------------------------------------------------------
# Collection: /notes
# ---------------------------------------------------------------------------

# TODO: Which method LISTS (reads) a collection?
# Hint: get (lowercase: @app.get)
@app.get("/notes")
# TODO: limit must be at least 1 and at most 100: other values are rejected (422), not clamped
# Hint: ge means "greater than or equal to" (1), le means "less than or equal to" (100)
def list_notes(
    request: Request,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int | None, Query(ge=0)] = None,
    cursor: Annotated[str | None, Query()] = None,
) -> OffsetNoteList | CursorNoteList:
    """List notes, newest first. Offset mode (?offset=&limit=) or cursor mode (?cursor=&limit=)."""
    # TODO: offset and cursor are two different strategies: reject requests that mix them
    # Hint: 400 Bad Request
    if offset is not None and cursor is not None:
        raise HTTPException(status_code=400, detail="Use either offset or cursor, not both.")

    ordered = sorted(notes.values(), key=lambda note: note.id, reverse=True)
    if offset is not None:
        result = offset_page(request, ordered, offset, limit)
    else:
        result = cursor_page(request, ordered, cursor, limit)

    link = link_header(result.page.next, result.page.prev)
    if link:
        response.headers["Link"] = link
    return result


@app.post("/notes", status_code=201)
def create_note(data: NoteCreate, request: Request, response: Response) -> Note:
    note = add_note(data.title, data.content)
    # 201 Created must say WHERE the new note lives
    response.headers["Location"] = str(request.url_for("get_note", note_id=note.id))
    return note


# ---------------------------------------------------------------------------
# Item: /notes/{note_id} (same as exercise 05)
# ---------------------------------------------------------------------------

@app.get("/notes/{note_id}")
def get_note(note_id: int) -> Note:
    return get_or_404(note_id)


# PUT replaces the WHOLE note: NoteCreate makes title required (content defaults to "")
@app.put("/notes/{note_id}")
def replace_note(note_id: int, data: NoteCreate) -> Note:
    note = get_or_404(note_id)
    note.title = data.title
    note.content = data.content
    note.updated_at = now_iso()
    return note


# PATCH changes only the fields that are sent
@app.patch("/notes/{note_id}")
def update_note(note_id: int, data: NoteUpdate) -> Note:
    note = get_or_404(note_id)
    # exclude_unset: only the fields the client really sent (exclude_none: a null means "not sent")
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(note, field, value)
    note.updated_at = now_iso()
    return note


@app.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int) -> Response:
    get_or_404(note_id)
    del notes[note_id]
    # 204 means NO body, so we return an empty Response instead of a value
    return Response(status_code=204)