#!/bin/bash

echo "Starting IRIV Vision Studio (Backend + Frontend)..."
echo "Press Ctrl+C to stop both servers."
echo ""

# We use npx concurrently to run both processes in parallel.
# It automatically prefixes logs, color-codes them, and kills both when you press Ctrl+C.
npx concurrently \
  -n "BACKEND,FRONTEND,MEDIAMTX" \
  -c "cyan.bold,green.bold,yellow.bold" \
  "cd backend && . venv/bin/activate && uvicorn web_server.main:app --host 0.0.0.0 --port 8000" \
  "cd frontend && npm run dev" \
  "cd backend/mediamtx && ./mediamtx"
