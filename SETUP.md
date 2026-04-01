# gigHood — Team Onboarding & Setup

The team shares a single remote Supabase database and external API integrations. Getting both the backend and frontend running locally is straightforward.

---

## 1. Automated Bootstrap (Backend)

Setup scripts handle the heavy lifting for the **Python backend**.

**What the script does:**
1. Creates a fresh Python virtual environment (`venv`) from scratch (untracked by Git).
2. Installs all FastAPI and ML dependencies from `backend/requirements.txt`.
3. Creates your `backend/.env` template from `backend/.env.example`.

### Mac / Linux
```bash
chmod +x setup.sh
./setup.sh
```

### Windows
```cmd
setup.bat
```

---

## 2. Populate Secrets

Once the script creates `backend/.env`, fill in the shared team keys:

| Key | Where to get it |
|:---|:---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_KEY` | Supabase dashboard → Project Settings → API (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API (service role key) |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay dashboard (sandbox) |
| `JWT_SECRET` | Any random 32-char string |
| `FIREBASE_CREDENTIALS_PATH` | Path to `backend/firebase-credentials.json` (obtain from team) |

> ⚠️ `.env` and `firebase-credentials.json` are excluded by `.gitignore` — safe from accidental commits.

---

## 3. Start the Backend

Activate the virtual environment and start the dev server from the **project root**:

**Mac/Linux:**
```bash
source venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

**Windows:**
```cmd
venv\Scripts\activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

- **API Base URL:** [http://127.0.0.1:8001](http://127.0.0.1:8001)
- **Swagger / OpenAPI Docs:** [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)

> **Important:** Always run `uvicorn` from the project root (not from inside `backend/`) using the `backend.main:app` module path. Running from inside `backend/` breaks relative imports.

---

## 4. Start the Worker Web App (Frontend)

The worker-facing app is a **Next.js worker dashboard app** located at `frontend/worker-app/`.

```bash
cd frontend/worker-app
npm install
npm run dev
```

- **App URL (default):** [http://localhost:3000](http://localhost:3000)
- The app is a mobile-viewport PWA styled for 440px width — open in your browser with DevTools set to a phone viewport for the best experience.
- The app reads from the backend at `http://localhost:8001` — ensure the backend is running first.

> **Environment variable:** If the backend URL changes, update `NEXT_PUBLIC_API_URL` in `frontend/worker-app/.env.local`.

### Current Worker App Routes

- `/` → redirects to `/home`
- `/login` → OTP/auth entry
- `/register` → worker onboarding with mandatory Terms & Conditions consent
- `/home` → dashboard, DCI status, and payout simulation controls
- `/chat` → AI assistant chat
- `/payouts` → payout history
- `/profile` → profile, trust score, and coverage certificate

---

## 5. Running the Demo Pipeline

To run the full end-to-end backend demo (registration → DCI → fraud → payout) in the terminal:

```bash
source venv/bin/activate
python -m backend.demo_runner
```

---

## 6. Docker Setup (Optional)

For exact system parity across macOS/Linux/Windows:

1. Ensure Docker Desktop is running.
2. Copy `backend/.env.example` to `backend/.env` and add your keys.
3. From the project root:
   ```bash
   docker compose up --build -d
   ```
4. To stop:
   ```bash
   docker compose down
   ```

---

## CI/CD

GitHub Actions workflows run automatically:

| Workflow | Trigger | Purpose |
|:---|:---|:---|
| **Dependency Review** | PRs to `main` | Blocks PRs with known vulnerabilities |
| **Backend CI** | PRs to `main` | Runs full `pytest` suite |
| **Docker Publish** | Push to `main` / new tag | Pushes `ghcr.io` image |
| **Release Automation** | `v*.*.*` tag | Generates clean changelogs |
