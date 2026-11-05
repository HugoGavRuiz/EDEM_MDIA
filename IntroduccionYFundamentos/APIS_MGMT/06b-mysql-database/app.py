"""
Library API - MySQL (Starter)

Run it with:  docker compose up -d --wait   (first, so MySQL is running)
         then: fastapi dev app.py
Fill the blanks (_____) from top to bottom. The app starts once the PATCH and DELETE decorators
(with the status_code of DELETE) and the le= of the limit are complete. The other blanks sit
inside functions or SQL strings, so you notice them when a request reaches them (a 500 or a wrong answer).
"""

import os
import re
from contextlib import contextmanager
from datetime import datetime
from http import HTTPStatus
from pathlib import Path
from typing import Annotated, Iterator

import pymysql
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator
from pymysql.cursors import DictCursor
from pymysql.err import IntegrityError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Load the .env of the exercise folder (next to .env.example); a variable set in the terminal wins
load_dotenv(Path(__file__).resolve().parent / ".env")

MYSQL = {
    "host": os.environ.get("MYSQL_HOST") or "127.0.0.1",
    "port": int(os.environ.get("MYSQL_PORT") or 3306),
    "user": os.environ.get("MYSQL_USER") or "library",
    "password": os.environ.get("MYSQL_PASSWORD") or "library-pass",
    "database": os.environ.get("MYSQL_DATABASE") or "library",
}

app = FastAPI(title="Library API")


# ---------- Models ----------

class AuthorRef(BaseModel):
    id: int
    name: str


class Book(BaseModel):
    id: int
    title: str
    isbn: str | None
    year: int | None
    author: AuthorRef
    created_at: str
    updated_at: str


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    isbn: str | None = Field(None, pattern=r"^\d{13}$")
    year: int | None = Field(None, ge=-3000, le=2100)
    author_id: int


# PATCH: every field is optional; only the ones the client sends are changed
class BookUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    isbn: str | None = Field(None, pattern=r"^\d{13}$")
    year: int | None = Field(None, ge=-3000, le=2100)
    author_id: int | None = None

    # Runs after the fields are validated: an empty body (or only nulls) is a 422
    @model_validator(mode="after")
    def at_least_one_field(self):
        if all(value is None for value in self.model_dump().values()):
            raise ValueError("Send at least one of: title, isbn, year, author_id")
        return self


class PageInfo(BaseModel):
    limit: int
    offset: int
    total: int
    next: str | None
    prev: str | None


class BookList(BaseModel):
    data: list[Book]
    page: PageInfo


# ---------- Database ----------

class DatabaseUnavailable(Exception):
    """MySQL is not reachable (Docker stopped, container still starting, wrong .env...)."""


def unavailable_reason(exc: OperationalError) -> str:
    """A message that tells the student what to check."""
    where = f"MySQL at {MYSQL['host']}:{MYSQL['port']}"
    if exc.args[0] == 2003:  # nobody answers on that host and port
        return f"Cannot connect to {where}. Is Docker running? Start it with: docker compose up -d"
    # MySQL answered but said no (1045 wrong user or password, 1049 unknown database...)
    return (f"{where} refused the connection: {exc.args[1]}. Check the .env of this folder "
            "(copied from .env.example?). If you changed the credentials after the first start, "
            "reset the database with: docker compose down -v")


@contextmanager
def db() -> Iterator[pymysql.connections.Connection]:
    """Open one connection for this request and always close it.

    autocommit is off: nothing you write is saved until you call conn.commit().
    If the block raises, whatever was not committed is rolled back.
    """
    try:
        conn = pymysql.connect(**MYSQL, charset="utf8mb4", cursorclass=DictCursor,
                               init_command="SET time_zone = '+00:00'", autocommit=False,
                               connect_timeout=3)
    except OperationalError as exc:
        raise DatabaseUnavailable(unavailable_reason(exc)) from exc
    try:
        yield conn
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def integrity_error(exc: IntegrityError) -> HTTPException:
    """Translate a MySQL constraint error into the right HTTP error."""
    code, message = exc.args[0], str(exc.args[1])
    if code == 1062:  # Duplicate entry: a UNIQUE column (isbn, author name) already has this value
        match = re.search(r"Duplicate entry '(.*)' for key", message)
        value = match.group(1) if match else "This value"
        # TODO: The value already exists. Which status code means "conflicts with the current state"?
        # Hint: 409 Conflict
        return HTTPException(status_code=409, detail=f"'{value}' already exists and must be unique.")
    if code == 1451:  # A row we try to delete is still referenced by a foreign key
        return HTTPException(status_code=409, detail="Other rows still point to this one.")
    if code == 1452:  # The foreign key points to a row that does not exist
        return HTTPException(status_code=422, detail="author_id does not match any author.")
    return HTTPException(status_code=409, detail="The change breaks a database constraint.")


def contains(text: str) -> str:
    """LIKE pattern for 'contains text'. \\ % and _ are escaped so they match literally."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def iso(value: datetime) -> str:
    """MySQL TIMESTAMP (read in UTC) -> '2026-11-04T09:30:00Z'."""
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


# The same SELECT for one book and for the list: the JOIN brings the author's name
BOOK_SELECT = """
    SELECT b.id, b.title, b.isbn, b.year, b.created_at, b.updated_at,
           a.id AS author_id, a.name AS author_name
    FROM books b
    JOIN authors a ON a.id = b.author_id
"""


def to_book(row: dict) -> Book:
    """One database row -> the Book the API returns."""
    return Book(id=row["id"], title=row["title"], isbn=row["isbn"], year=row["year"],
                author=AuthorRef(id=row["author_id"], name=row["author_name"]),
                created_at=iso(row["created_at"]), updated_at=iso(row["updated_at"]))


def get_book_or_404(cur, book_id: int) -> Book:
    # TODO: Never paste values into the SQL text. Which placeholder does PyMySQL replace with book_id?
    # Hint: %s (PyMySQL sends book_id as a value, never as part of the SQL text)
    cur.execute(BOOK_SELECT + " WHERE b.id = %s", (book_id,))
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Book {book_id} does not exist.")
    return to_book(row)


# Probe once at start-up, only to print a friendly warning. The app starts anyway.
try:
    with db():
        pass
except DatabaseUnavailable as exc:
    print(f"WARNING: {exc}")


# ---------- Errors: RFC 9457 problem details ----------

def problem(request: Request, status: int, title: str, detail: str, **extra) -> JSONResponse:
    """RFC 9457 problem details: one error format for the whole API."""
    body = {"type": "about:blank", "title": title, "status": status, "detail": detail,
            "instance": request.url.path, **extra}
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


@app.exception_handler(StarletteHTTPException)
def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    response = problem(request, exc.status_code, HTTPStatus(exc.status_code).phrase, str(exc.detail))
    response.headers.update(exc.headers or {})
    return response


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return problem(request, 422, "Unprocessable Content", "Request body or parameters are invalid.",
                   errors=jsonable_encoder(exc.errors()))


@app.exception_handler(DatabaseUnavailable)
def database_unavailable(request: Request, exc: DatabaseUnavailable) -> JSONResponse:
    return problem(request, 503, "Service Unavailable", str(exc))


# ---------- Books ----------

@app.post("/books", status_code=201)
def create_book(data: BookCreate, request: Request, response: Response) -> Book:
    with db() as conn, conn.cursor() as cur:
        try:
            cur.execute("INSERT INTO books (title, isbn, year, author_id) VALUES (%s, %s, %s, %s)",
                        (data.title, data.isbn, data.year, data.author_id))
        except IntegrityError as exc:
            raise integrity_error(exc)
        # TODO: The database generated the id (AUTO_INCREMENT). Which cursor attribute tells us which one?
        # Hint: lastrowid
        book_id = cur.lastrowid
        # TODO: Nothing is saved until we confirm it. Which connection method saves the changes?
        # Hint: commit (the other endpoints already call it; look at replace_book)
        conn.commit()
        book = get_book_or_404(cur, book_id)
    # TODO: 201 Created must say WHERE the new book lives, in a response header
    # Hint: the header is called Location; its value is the URL of the new book
    response.headers["Location"] = str(request.url_for("get_book", book_id=book.id))
    return book


@app.get("/books/{book_id}")
def get_book(book_id: int) -> Book:
    with db() as conn, conn.cursor() as cur:
        return get_book_or_404(cur, book_id)


# PUT replaces the WHOLE book: BookCreate makes title and author_id required (isbn and year become null if missing)
@app.put("/books/{book_id}")
def replace_book(book_id: int, data: BookCreate) -> Book:
    with db() as conn, conn.cursor() as cur:
        get_book_or_404(cur, book_id)
        try:
            cur.execute("UPDATE books SET title = %s, isbn = %s, year = %s, author_id = %s WHERE id = %s",
                        (data.title, data.isbn, data.year, data.author_id, book_id))
        except IntegrityError as exc:
            raise integrity_error(exc)
        conn.commit()
        return get_book_or_404(cur, book_id)


# TODO: Which method changes only SOME fields of a resource?
# Hint: patch (lowercase: @app.patch). The body is BookUpdate: every field is optional
@app.patch("/books/{book_id}")
def update_book(book_id: int, data: BookUpdate) -> Book:
    with db() as conn, conn.cursor() as cur:
        get_book_or_404(cur, book_id)
        changes = data.model_dump(exclude_unset=True, exclude_none=True)
        # The column NAMES come from our own model (title, isbn, year, author_id), never from the client,
        # and the VALUES still travel as %s parameters: no way to inject SQL here
        assignments = ", ".join(f"{column} = %s" for column in changes)
        try:
            cur.execute(f"UPDATE books SET {assignments} WHERE id = %s", (*changes.values(), book_id))
        except IntegrityError as exc:
            raise integrity_error(exc)
        conn.commit()
        return get_book_or_404(cur, book_id)


# TODO: Which method removes a resource? And which status code says "done, nothing to send back"?
# Hint: delete (lowercase: @app.delete); the status_code is the same one the function returns below (204)
@app.delete("/books/{book_id}", status_code=204)
def delete_book(book_id: int) -> Response:
    with db() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM books WHERE id = %s", (book_id,))
        # TODO: How many rows did the DELETE remove? 0 means the book was not there (404)
        # Hint: rowcount
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Book {book_id} does not exist.")
        conn.commit()
    # 204 means NO body, so we return an empty Response instead of a value
    # Hint: 204 No Content
    return Response(status_code=204)


@app.get("/books")
# TODO: Values above 100 must be rejected (422), not clamped. What is the maximum?
# Hint: le means "less than or equal"; the maximum is 100
def list_books(
    request: Request,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    author_id: int | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> BookList:
    """List books by id. ?limit= (1-100), ?offset=, filters ?author_id= and ?q= (part of the title)."""
    where, params = [], []
    if author_id is not None:
        where.append("b.author_id = %s")
        params.append(author_id)
    if q:
        # NEVER build SQL with the user's text, like this:
        #     cur.execute(f"... WHERE b.title LIKE '%{q}%'")
        # A q such as  ' OR '1'='1  would become part of the SQL (SQL injection).
        # With %s the text is sent as a value.
        where.append("b.title LIKE %s")
        params.append(contains(q))
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM books b" + where_sql, params)
        total = cur.fetchone()["total"]
        # TODO: Ask MySQL for one page only: at most `limit` rows, skipping the first `offset`
        # Hint: the same placeholder as before, twice (the values are the last two of the tuple)
        cur.execute(BOOK_SELECT + where_sql + " ORDER BY b.id LIMIT %s OFFSET %s", (*params, limit, offset))
        books = [to_book(row) for row in cur.fetchall()]

    def link(new_offset: int) -> str:
        return str(request.url.include_query_params(offset=new_offset, limit=limit))

    next_link = link(offset + limit) if offset + limit < total else None
    prev_link = link(max(0, min(offset, total) - limit)) if offset > 0 else None
    return BookList(data=books, page=PageInfo(limit=limit, offset=offset, total=total,
                                              next=next_link, prev=prev_link))


# ---------- Authors ----------

class NewAuthorBook(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    isbn: str | None = Field(None, pattern=r"^\d{13}$")
    year: int | None = Field(None, ge=-3000, le=2100)


class AuthorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    country: str | None = Field(None, max_length=60)
    birth_year: int | None = Field(None, ge=-3000, le=2100)
    books: list[NewAuthorBook] = []


class Author(BaseModel):
    id: int
    name: str
    country: str | None
    birth_year: int | None
    book_count: int


class AuthorList(BaseModel):
    data: list[Author]


AUTHOR_SELECT = """
    SELECT a.id, a.name, a.country, a.birth_year,
           (SELECT COUNT(*) FROM books b WHERE b.author_id = a.id) AS book_count
    FROM authors a
"""


def get_author_or_404(cur, author_id: int) -> Author:
    cur.execute(AUTHOR_SELECT + " WHERE a.id = %s", (author_id,))
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Author {author_id} does not exist.")
    return Author(**row)


@app.get("/authors")
def list_authors(q: Annotated[str | None, Query(max_length=100)] = None) -> AuthorList:
    """All authors (a small table, no pagination). ?q= filters by part of the name."""
    with db() as conn, conn.cursor() as cur:
        if q:
            cur.execute(AUTHOR_SELECT + " WHERE a.name LIKE %s ORDER BY a.id", (contains(q),))
        else:
            cur.execute(AUTHOR_SELECT + " ORDER BY a.id")
        return AuthorList(data=[Author(**row) for row in cur.fetchall()])


@app.get("/authors/{author_id}")
def get_author(author_id: int) -> Author:
    with db() as conn, conn.cursor() as cur:
        return get_author_or_404(cur, author_id)


@app.post("/authors", status_code=201)
def create_author(data: AuthorCreate, request: Request, response: Response) -> Author:
    """Create an author and, optionally, their books, in ONE transaction."""
    with db() as conn, conn.cursor() as cur:
        # All or nothing: commit only if every INSERT worked; rollback undoes them all.
        # Without the transaction, a duplicate ISBN in the 2nd book would leave the author
        # and the 1st book saved, and the client would get an error for a half-done request.
        try:
            cur.execute("INSERT INTO authors (name, country, birth_year) VALUES (%s, %s, %s)",
                        (data.name, data.country, data.birth_year))
            author_id = cur.lastrowid
            for book in data.books:
                cur.execute("INSERT INTO books (title, isbn, year, author_id) VALUES (%s, %s, %s, %s)",
                            (book.title, book.isbn, book.year, author_id))
            conn.commit()
        except IntegrityError as exc:
            conn.rollback()
            raise integrity_error(exc)
        author = get_author_or_404(cur, author_id)
    response.headers["Location"] = str(request.url_for("get_author", author_id=author.id))
    return author


@app.delete("/authors/{author_id}", status_code=204)
def delete_author(author_id: int) -> Response:
    with db() as conn, conn.cursor() as cur:
        try:
            cur.execute("DELETE FROM authors WHERE id = %s", (author_id,))
        except IntegrityError as exc:
            # The foreign key of books protects the data: MySQL refuses (error 1451)
            if exc.args[0] == 1451:
                raise HTTPException(status_code=409,
                                    detail=f"Author {author_id} still has books. Delete or move them first.")
            raise integrity_error(exc)
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Author {author_id} does not exist.")
        conn.commit()
    return Response(status_code=204)