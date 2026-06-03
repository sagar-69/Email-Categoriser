@echo off
echo Starting Inbox Intel Project (Windows)...

echo Starting Ollama...
start "Ollama" ollama serve

echo Starting FastAPI Server...
call venv\Scripts\activate.bat
start "FastAPI" uvicorn api.server:app --port 8000

echo Starting React Dashboard...
cd react-dashboard
start "React Dashboard" npm run dev
cd ..

echo All services are starting up in new windows!
echo 👉 Open your browser to: http://localhost:5173
echo Close the individual command prompt windows to shut down services.
pause
