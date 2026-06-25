#!/bin/bash

echo "Starting Inbox Intel Project..."
PWD_PATH=$(pwd)

# 1. Start Ollama AI engine
echo "Starting Ollama..."
ollama serve &
OLLAMA_PID=$!

# 2. Determine SSL flags by reading .env (not by checking cert files)
SSL_FLAGS=""
if [ -f ".env" ]; then
    SSL_KEY=$(grep -E '^SSL_KEYFILE=' .env 2>/dev/null | cut -d'=' -f2-)
    SSL_CERT=$(grep -E '^SSL_CERTFILE=' .env 2>/dev/null | cut -d'=' -f2-)
fi

if [ -n "$SSL_KEY" ] && [ -n "$SSL_CERT" ] && [ -f "$SSL_KEY" ] && [ -f "$SSL_CERT" ]; then
    echo "🔒 SSL enabled via .env — starting FastAPI with HTTPS"
    SSL_FLAGS="--ssl-keyfile $SSL_KEY --ssl-certfile $SSL_CERT"
else
    echo "🔓 Running FastAPI with HTTP (to enable HTTPS, uncomment SSL lines in .env)"
fi

# 3. Start FastAPI Server
echo "Starting FastAPI Server..."
source venv/bin/activate
uvicorn api.server:app --port 8000 $SSL_FLAGS &
FASTAPI_PID=$!

# 4. Start React Dashboard
echo "Starting React Dashboard..."
cd react-dashboard
npm run dev &
REACT_PID=$!
cd ..

echo "All services are starting up!"
if [ -n "$SSL_FLAGS" ]; then
    echo "👉 Open your browser to: https://localhost:5173"
else
    echo "👉 Open your browser to: http://localhost:5173"
fi
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
