#!/bin/bash

echo "Starting Inbox Intel Project..."
PWD_PATH=$(pwd)

# 1. Start Ollama AI engine
osascript -e "tell app \"Terminal\" to do script \"ollama serve\""

# 2. Start FastAPI Server
osascript -e "tell app \"Terminal\" to do script \"cd \\\"${PWD_PATH}\\\" && source venv/bin/activate && uvicorn api.server:app --port 8000\""

# 3. Start React Dashboard
osascript -e "tell app \"Terminal\" to do script \"cd \\\"${PWD_PATH}/react-dashboard\\\" && npm run dev\""

echo "All services are starting up in new windows!"
echo "👉 Open your browser to: http://localhost:5173"
