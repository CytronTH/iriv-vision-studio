---
name: Backend & API Standards
description: Enforces Python, FastAPI, and async best practices.
trigger: always_on
---

# Backend & API Coding Standards

1. **Type Hinting**: All Python functions, methods, and API routes MUST use strict Type Hinting (PEP 484).
2. **Asynchronous I/O**: Any I/O bound operation (Database calls, HTTP requests, WebSocket broadcasting, RS485 communication) MUST use `async` / `await` to prevent blocking the event loop.
3. **Structured Logging**: NEVER use `print()`. Use the standard Python `logging` module or `loguru`. Log messages must be descriptive and include context.
4. **Error Handling**: Use global exception handlers in FastAPI. Do not expose internal server error stack traces to the client.
