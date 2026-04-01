@echo off
echo =========================================
echo   gigHood Backend Setup Script (Windows)
echo =========================================
echo.

:: 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.11+.
    exit /b 1
)
echo [OK] Python found.

:: 2. Setup Virtual Environment
echo [INFO] Creating a new virtual environment (venv) locally because it is not tracked in Git...
if not exist "venv" (
    python -m venv venv
    echo [OK] Virtual environment created.
)
call venv\Scripts\activate.bat

:: 3. Install Dependencies
echo [INFO] Installing requirements...
python -m pip install --upgrade pip
if exist "backend\requirements.txt" (
    pip install -r backend\requirements.txt
) else (
    echo [ERROR] backend\requirements.txt not found. Are you in the project root?
    exit /b 1
)

:: 4. Setup .env file
echo [INFO] Configuring environment variables...
if not exist "backend\.env" (
    copy backend\.env.example backend\.env >nul
    echo [OK] Created backend\.env from template.
    echo [WARNING] IMPORTANT: Please open backend\.env and fill in your API keys!
) else (
    echo [OK] backend\.env already exists.
)

:: 5. Check Firebase Credentials
if not exist "backend\firebase-credentials.json" (
    echo [WARNING] NOTE: backend\firebase-credentials.json is missing.
    echo          Please ask the team for the firebase service account key and place it there.
) else (
    echo [OK] Firebase credentials found.
)

echo.
echo =========================================
echo   Setup Complete!
echo =========================================
echo To start the development server:
echo 1. Activate environment: venv\Scripts\activate
echo 2. Add your keys to backend\.env
echo 3. Run backend from repo root: uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
echo 4. Run frontend in another terminal: cd frontend ^& npm install ^& npm run dev
pause
