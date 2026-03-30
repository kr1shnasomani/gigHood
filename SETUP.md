# gigHood — Team Onboarding & Setup

Since the entire team is sharing the same remote Supabase database and external infrastructure, getting your local backend up and running is as simple as running a single script.

## 1. Automated Bootstrap

We have provided automated setup scripts that do the heavy lifting. **Running the script will automatically:**
1. Create a fresh Python virtual environment (`venv`) from scratch (since it is untracked by Git).
2. Install all strict FastAPI and ML dependencies from `backend/requirements.txt`.
3. Auto-generate your `backend/.env` template configuration file.

### For Mac / Linux Users
Open your terminal in the root of the project and run:

```bash
chmod +x setup.sh
./setup.sh
```

### For Windows Users
Open your command prompt or PowerShell in the root of the project and run:

```cmd
setup.bat
```

## 2. Populate Safe Secrets

Once the script finishes formatting the backend, you simply need to link it to the live team infrastructure:

1. **API Keys:** Open the newly generated `backend/.env` file and paste the shared team keys (Supabase Service Role, Razorpay, OpenWeather, Groq, etc.).
2. **Firebase:** Obtain the `firebase-credentials.json` file from the team and place it directly inside the `backend/` folder.

*(Note: Both the `.env` file and the `firebase-credentials.json` are excluded via `.gitignore` and are perfectly safe from accidental commits).*

## 3. Start the Server

Whenever you are ready to code, just activate the virtual environment and start the dev server from inside the `backend` directory:

**Mac/Linux:**
```bash
source venv/bin/activate
cd backend
uvicorn main:app --reload
```

**Windows:**
```cmd
venv\Scripts\activate
cd backend
uvicorn main:app --reload
```

- API Base URL: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- OpenAPI / Swagger Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## 4. Docker Setup (Optional)

If you prefer to run the backend via Docker, ensuring exact system parity across macOS, Linux, and Windows:

1. Ensure Docker Desktop is running.
2. Copy `backend/.env.example` to `backend/.env` and add your keys.
3. In the root directory, run:
   ```bash
   docker compose up --build -d
   ```
4. To stop the container later:
   ```bash
   docker compose down
   ```

## CI/CD 

This repository is equipped with GitHub Actions for Continuous Integration and Delivery:
- **Dependency Review**: Blocks PRs that introduce known vulnerabilities.
- **Backend CI**: Runs the `pytest` suite strictly on every pull request to `main`.
- **Docker Publish**: Pushes a new `ghcr.io` image when pushing to `main` or cutting a release.
- **Release Automation**: Generates clean changelogs for any new `v*.*.*` tag.
