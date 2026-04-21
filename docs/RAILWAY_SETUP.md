# Railway Deployment Guide

## What to pull from Supabase

| Value | Where to find it |
|---|---|
| `SUPABASE_URL` | Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_KEY` | Dashboard → Settings → API → service_role key |
| `SUPABASE_JWT_SECRET` | Dashboard → Settings → API → JWT Secret |
| `DATABASE_URL` | Dashboard → Settings → Database → Connection string → Transaction mode (port 6543) |

## Railway deployment steps

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select the Crawl repo
2. Set **Root Directory** to `apps/api`
3. Set **Build Command** to `npm run build`
4. Set **Start Command** to `node dist/index.js`
5. Under **Variables**, add every key from the table above plus:
   - `PORT=3000`
   - `NODE_ENV=staging`
   - `USE_REAL_DB=true`
6. Click **Deploy** — watch build logs for TypeScript errors
7. Once live, hit `GET https://<your-railway-url>/api/v1/health` — expect `{"status":"ok"}`
8. Update the RN app's `EXPO_PUBLIC_API_URL` to `https://<your-railway-url>/api/v1`

## PostGIS + migration steps (do these before first deploy)

1. Supabase Dashboard → **Database** → **Extensions** → search "postgis" → **Enable**
2. Locally, with `DATABASE_URL` set in `apps/api/.env`:
   ```bash
   cd apps/api
   npm run db:migrate   # pushes Drizzle schema to Supabase (creates venues, users, votes tables)
   npm run db:seed      # inserts Charlotte NC and Patchogue/Sayville NY venues
   ```
3. Verify in Supabase **Table Editor** that `venues`, `users`, `votes` tables exist with data
