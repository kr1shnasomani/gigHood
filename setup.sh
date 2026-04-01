#!/bin/bash
# gigHood Backend Setup Script (Mac/Linux)

echo "🚀 Starting gigHood backend setup..."

# 1. Check for Python 3.11+
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+."
    exit 1
fi

echo "✅ Python 3 found."

# 2. Setup Virtual Environment
echo "📦 Creating a new virtual environment (venv) locally because it is not tracked in Git..."
python3 -m venv venv
echo "✅ Virtual environment created."
source venv/bin/activate

# 3. Install Dependencies
echo "📥 Installing requirements..."
pip install --upgrade pip
if [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
else
    echo "❌ backend/requirements.txt not found. Are you in the project root?"
    exit 1
fi

# 4. Setup .env file
echo "⚙️ Configuring environment variables..."
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env from template."
    echo "⚠️  IMPORTANT: Please open backend/.env and fill in your API keys!"
else
    echo "✅ backend/.env already exists."
fi

# 5. Check Firebase Credentials
if [ ! -f "backend/firebase-credentials.json" ]; then
    echo "⚠️  NOTE: backend/firebase-credentials.json is missing."
    echo "   Please ask the team for the firebase service account key and place it there."
else
    echo "✅ Firebase credentials found."
fi

echo ""
echo "🎉 Setup Complete!"
echo "To start the development server:"
echo "1. Activate the environment: source venv/bin/activate"
echo "2. Add your keys to backend/.env"
echo "3. Run backend from repo root: uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001"
echo "4. Run frontend in a second terminal: cd frontend && npm install && npm run dev"
