"""
Notes API - CRUD (Starter)

Run it with:  fastapi dev app.py
Fill the blanks (_____) from top to bottom; the app starts once the PUT, PATCH and DELETE decorators (with the status_code of DELETE) and the le= of the limit are complete.
"""

from datetime import datetime, timezone
from http import HTTPStatus
from typing import Annotated

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


class PageInfo(BaseModel):
    limit: int
    total: int


class NoteList(BaseModel):
    data: list[Note]
    page: PageInfo


# In-memory data store. Everything is lost when the app restarts.
notes: dict[int, Note] = {}
next_id = 1


def now_iso() -> str:
    """Current time in ISO 8601, UTC (e.g. '2026-10-26T09:30:00Z')."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def add_note(title: str, content: str = "") -> Note:
    """Store a new note and return it. The server assigns id and timestamps."""
    global next_id
    timestamp = now_iso()
    note = Note(id=next_id, title=title, content=content, created_at=timestamp, updated_at=timestamp)
    notes[note.id] = note
    next_id += 1
    return note


# Seed data, so GET /notes is not empty on the first run
add_note("Welcome", "This is your Notes API.")
add_note("Shopping list", "Milk, eggs, coffee")
add_note("API Management", "Status codes, Location header and RFC 9457 errors")


def problem(request: Request, status: int, title: str, detail: str, **extra) -> JSONResponse:
    """RFC 9457 problem details: one error format for the whole API."""
    body = {"type": "about:blank", "title": title, "status": status, "detail": detail,
            "instance": request.url.path, **extra}
    # TODO: Set the media type for problem details (RFC 9457)
    # Hint: 'application/problem+json'
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
    # TODO: Validation failed -> which status code? (the same 422 as the title in the body)
    # Hint: 422 Unprocessable Content
    return problem(request, 422, "Unprocessable Content", "Request body or parameters are invalid.",
                   errors=jsonable_encoder(exc.errors()))


def get_or_404(note_id: int) -> Note:
    if note_id not in notes:
        raise HTTPException(status_code=404, detail=f"Note {note_id} does not exist.")
    return notes[note_id]


@app.post("/notes", status_code=201)
def create_note(data: NoteCreate, request: Request, response: Response) -> Note:
    note = add_note(data.title, data.content)
    # TODO: 201 Created must say WHERE the new note lives, in a response header
    # Hint: the header is called Location; its value is the URL of the new note
    response.headers["Location"] = str(request.url_for("get_note", note_id=note.id))
    return note


@app.get("/notes/{note_id}")
def get_note(note_id: int) -> Note:
    return get_or_404(note_id)


# TODO: Which method REPLACES a whole resource?
# Hint: put (lowercase: @app.put). The body is NoteCreate, so title is required (content defaults to "")
@app.put("/notes/{note_id}")
def replace_note(note_id: int, data: NoteCreate) -> Note:
    note = get_or_404(note_id)
    note.title = data.title
    note.content = data.content
    note.updated_at = now_iso()
    return note


# TODO: Which method changes only SOME fields of a resource?
# Hint: patch (lowercase: @app.patch). The body is NoteUpdate: every field is optional
@app.patch("/notes/{note_id}")
def update_note(note_id: int, data: NoteUpdate) -> Note:
    note = get_or_404(note_id)
    # TODO: Keep only the fields the client really sent (the others stay as they are)
    # Hint: exclude_unset=True  (exclude_none=True makes a null count as "not sent")
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(note, field, value)
    note.updated_at = now_iso()
    return note


# TODO: Which method removes a resource? And which status code says "done, nothing to send back"?
# Hint: delete (lowercase: @app.delete); the decorator's status_code is the same one the function returns below
@app.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int) -> Response:
    get_or_404(note_id)
    del notes[note_id]
    # TODO: Success, and nothing to send back. Which status code?
    # 204 means NO body, so we return an empty Response instead of a value
    # Hint: 204 No Content
    return Response(status_code=204)


# GET /notes comes last: it is the only route with a query parameter
@app.get("/notes")
# TODO: Values above 100 must be rejected (422), not clamped. What is the maximum?
# Hint: le means "less than or equal"; the maximum is 100
def list_notes(limit: Annotated[int, Query(ge=1, le=100)] = 20) -> NoteList:
    """List notes, newest first. ?limit= (default 20, between 1 and 100)."""
    newest_first = sorted(notes.values(), key=lambda note: note.id, reverse=True)
    return NoteList(data=newest_first[:limit], page=PageInfo(limit=limit, total=len(notes)))