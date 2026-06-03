#!/bin/bash

echo "Starting Inbox Intel Project (Linux)..."

# 1. Start Ollama AI engine
echo "Starting Ollama..."
ollama serve &
OLLAMA_PID=$!

# 2. Start FastAPI Server
echo "Starting FastAPI Server..."
source venv/bin/activate
uvicorn api.server:app --port 8000 &
FASTAPI_PID=$!

# 3. Start React Dashboard
echo "Starting React Dashboard..."
cd react-dashboard
npm run dev &
REACT_PID=$!
cd ..

echo "All services are starting up!"
echo "👉 Open your browser to: http://localhost:5173"
echo "Press Ctrl+C to gracefully stop all services."

# Trap SIGINT and SIGTERM to kill background processes
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill -TERM $OLLAMA_PID $FASTAPI_PID $REACT_PID 2>/dev/null
    wait $OLLAMA_PID $FASTAPI_PID $REACT_PID 2>/dev/null
    echo "Services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for background processes to finish
wait
