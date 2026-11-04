"""
FastAPI Introduction Exercise
Create a simple FastAPI application with basic routes and JSON responses.

Run it with:  fastapi dev app.py
Fill the blanks (_____) from top to bottom; the app starts once the decorators are complete.
"""

from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

app = FastAPI(title="FastAPI Intro")


# TODO: Create the body model for POST /api/greet with one text field called 'name'
# Hint: The field name is the key the client sends in the JSON body; it defaults to 'Guest'
class GreetRequest(BaseModel):
    name: str = "Guest"


@app.get("/", response_class=PlainTextResponse)
def index():
    return "Welcome to my first FastAPI application!"


# TODO: Create a route for '/about' that returns information about the app
# Hint: Write the path after the slash; return a string describing your app
@app.get("/about", response_class=PlainTextResponse)
def about():
    return "This is a FastAPI introduction exercise to learn basic routing and JSON handling."


# TODO: Create a route for '/api/hello' that returns a JSON message
# Hint: Give the function a name; FastAPI turns a returned dict into JSON
@app.get("/api/hello")
def hello():
    # TODO: Return a JSON object with a 'message' key
    # Hint: return {'message': 'your message here'}
    return {"message": "Hello, World!"}


# TODO: Create a route for '/api/user/{username}' that accepts a username parameter
# Hint: Put the parameter name in braces in the path and use the same name as a function parameter
@app.get("/api/user/{usename}")
def get_user(username: str):
    # TODO: Return a JSON object with the username
    # Hint: Return a dictionary with user information
    return {"username": username, "message": f"Welcome, {username}!"}


# TODO: Create a route for '/api/greet' that accepts POST requests
# Hint: The decorator is named after the HTTP method, in lowercase
@app.post("/api/greet")
def greet(body: GreetRequest):
    # TODO: Return a JSON response with a greeting
    # Hint: FastAPI already parsed the body into a GreetRequest; read the name with body.name
    return {"greeting": f"Hello, {body.name}!"}