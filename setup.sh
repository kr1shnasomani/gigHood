#!/bin/bash
# gigHood smart local setup (macOS/Linux)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "🚀 Starting gigHood setup from: $ROOT_DIR"

if ! command -v python3.11 >/dev/null 2>&1; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+."
    exit 1
fi
echo "✅ Python 3 found: $(python3.11 --version)"

if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3.11 -m venv venv
else
    echo "✅ Reusing existing virtual environment."
fi
source venv/bin/activate

echo "📥 Installing backend dependencies..."
python -m pip install --upgrade pip
if [ -f "backend/requirements.txt" ]; then
    python -m pip install -r backend/requirements.txt
elif [ -f "requirements.txt" ]; then
    python -m pip install -r requirements.txt
else
    echo "❌ No requirements file found (expected backend/requirements.txt or requirements.txt)."
    exit 1
fi

if command -v npm >/dev/null 2>&1; then
    echo "📥 Installing frontend dependencies..."
    pushd frontend >/dev/null
    if [ -f "package-lock.json" ]; then
        npm ci --legacy-peer-deps
    else
        npm install --legacy-peer-deps
    fi

    # Repair interrupted installs that create malformed @types folders (e.g., "node 2")
    if [ -d "node_modules/@types/node 2" ]; then
        rm -rf "node_modules/@types/node 2"
        echo "🧹 Removed malformed type folder: node_modules/@types/node 2"
    fi
    popd >/dev/null
    echo "✅ Frontend dependencies installed."
else
    echo "⚠️ npm is not installed. Frontend dependency setup skipped."
fi

echo "⚙️ Configuring env files..."
if [ ! -f "backend/.env" ] && [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env from template."
fi

if [ ! -f "frontend/.env.local" ] && [ -f "frontend/.env.example" ]; then
    cp frontend/.env.example frontend/.env.local
    echo "✅ Created frontend/.env.local from template."
fi

if [ ! -f "backend/firebase-credentials.json" ]; then
    echo "⚠️ backend/firebase-credentials.json is missing (needed only for push notification flows)."
fi

echo "🧠 Preparing risk profiler model..."
python -c "from backend.services.risk_profiler import load_model; load_model(); print('Risk profiler model is ready.')" || {
    echo "⚠️ Risk model prewarm failed. It will retry on backend startup."
}

if command -v docker >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
        echo "✅ Docker Compose is available for containerized runs."
    else
        echo "⚠️ Docker detected, but Docker Compose plugin is missing."
    fi
fi

echo
echo "🎉 Setup complete."
echo "Local run commands:"
echo "1) source venv/bin/activate"
echo "2) uvicorn backend.main:app --reload --reload-dir backend --host 0.0.0.0 --port 8001"
echo "3) (new terminal) cd frontend && npm run dev"
echo "4) Docker alternative: docker compose up --build"
