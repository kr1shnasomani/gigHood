# gigHood Frontend

This directory is the single canonical Next.js frontend for gigHood.

## App Surfaces

- `/` - public landing website
- `/worker-app/*` - worker experience (login, register, dashboard routes)
- `/admin-dashboard` - admin surface placeholder

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL:

- `http://localhost:3000`

Backend expected local URL:

- `http://localhost:8001`

If backend URL changes, set in:

- `frontend/.env.local` (`NEXT_PUBLIC_API_URL`)

## Build

```bash
cd frontend
npm run build
```

## Structure

- `src/app/` - App Router pages and layouts
- `src/components/` - reusable UI components
- `src/hooks/` - frontend hooks
- `src/lib/` - API and utility modules
- `src/store/` - Zustand state stores
