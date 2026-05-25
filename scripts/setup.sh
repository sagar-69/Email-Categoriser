#!/usr/bin/env bash
set -e

echo "=== inbox-intel setup ==="

# Create credential directory
mkdir -p ~/.inbox-intel

# Create and activate virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python deps
pip install -r requirements.txt

# Pull Ollama model
if command -v ollama &> /dev/null; then
    echo "Pulling phi3:mini model..."
    ollama pull phi3:mini
else
    echo "ERROR: Ollama not found. Install from https://ollama.com and re-run."
    exit 1
fi

# Initialise database
python -c "from data.store import init_db; init_db()"

echo "Setup complete. Copy .env.example to .env and fill in your Google OAuth credentials."
