"""
Notes API - Fundamentals (Starter)

Run it with:  fastapi dev app.py
Fill the blanks (_____) from top to bottom; the app starts once the decorators and the status_code of POST /notes are complete.
"""

from http import HTTPStatus

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI(title="Notes API")


# Field(min_length=1) rejects an empty title with a 422
class NoteCreate(BaseModel):
    title: str = Field(min_length=1)
    content: str = ""


class Note(BaseModel):
    id: int
    title: str
    content: str


# In-memory data store (simplified)
notes: dict[int, Note] = {}
next_id = 1


def problem(request: Request, status: int, title: str, detail: str, **extra) -> JSONResponse:
    """Build an error response in RFC 9457 "problem details" format.

    Every error of the API uses this one helper, so clients always get the same shape:
    {"type": "about:blank", "title": "...", "status": 404, "detail": "...", "instance": "/notes/99"}
    Extra keyword arguments (e.g. errors=[...]) are added as extension members.
    """
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


# FastAPI validates the request before your function runs; when it fails it raises
# RequestValidationError, and this handler turns it into the same problem format.
@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # TODO: Validation failed -> which status code? (its reason phrase, "Unprocessable Content", is already the title)
    # Hint: 422 Unprocessable Content
    return problem(request, 422, "Unprocessable Content", "Request body or parameters are invalid.",
                   errors=jsonable_encoder(exc.errors()))


# TODO: Create the health check route
# Hint: The decorator is named after the HTTP method, in lowercase: GET -> get
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# TODO: Create the route that lists the notes
# Hint: Use the same method as above; the return annotation list[Note] is the response model
@app.get("/notes")
def list_notes() -> list[Note]:
    return list(notes.values())


# TODO: Create the route that creates a note, and answer with the status code for "created"
# Hint: The method is post; the status code is 201
# FastAPI reads and validates the JSON body for you: `data: NoteCreate`
@app.post("/notes", status_code=201)
def create_note(data: NoteCreate, request: Request, response: Response) -> Note:
    global next_id
    note = Note(id=next_id, title=data.title, content=data.content)
    notes[note.id] = note
    next_id += 1
    # TODO: 201 Created must say WHERE the new note lives, in a response header
    # Hint: the header is called Location; its value is the URL of the new note
    response.headers["Location"] = str(request.url_for("get_note", note_id=note.id))
    return note


# TODO: Create the route that returns one note by id
# Hint: Use the method for reading; {note_id} is a path parameter, converted to int
@app.get("/notes/{note_id}")
def get_note(note_id: int) -> Note:
    if note_id not in notes:
        # TODO: The note does not exist -> which status code?
        # Hint: 404 Not Found
        raise HTTPException(status_code=404, detail=f"Note {note_id} does not exist.")
    return notes[note_id]