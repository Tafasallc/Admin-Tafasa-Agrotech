# Tafasa Agrotech — Admin Dashboard

## Local development
```
npm install
npm run dev
```
Opens at http://localhost:5173 with live-reload.

## Before you deploy — read this

This is a working prototype with **mock, in-memory data** and a **basic
password gate** (see `src/PasswordGate.jsx`) as a placeholder, not real
security. Before deploying somewhere real users or real data will touch:

1. **Set a real admin password.** Copy `.env.example` to `.env.local` and
   set `VITE_ADMIN_PASSWORD` to something only you know. Do this even for
   a demo link you share.
2. **Replace the password gate with real authentication** before this
   handles actual farmer/buyer/price data — e.g. a login endpoint on your
   backend, or a hosted auth provider (Firebase Auth, Auth0, Clerk).
   A client-side password is visible in the deployed code and should not
   be trusted with real data.
3. **Connect to a real backend.** Right now edits (prices, verifications,
   trust scores, service assignments) reset on refresh. Wire the
   `useState` calls in `src/App.jsx` to real API calls against your
   database (see the schema/ER diagram from earlier).

## Build for production
```
npm run build
```
Outputs static files to `dist/`. Preview the production build locally with:
```
npm run preview
```

## Deploying

### Option A — Vercel (recommended, easiest)
1. Push this project to a GitHub repo.
2. Go to vercel.com → New Project → import the repo.
3. Vercel auto-detects Vite; build command and output are already set via
   `vercel.json` in this project.
4. Add environment variable `VITE_ADMIN_PASSWORD` in the Vercel dashboard
   (Project Settings → Environment Variables) — don't rely on `.env.local`
   for deployed environments.
5. Deploy. You'll get a live URL (e.g. `tafasa-admin.vercel.app`).

### Option B — Netlify
1. Push to GitHub.
2. Go to netlify.com → Add new site → import the repo.
3. Build settings are pre-set via `netlify.toml` (`npm run build`, publish
   `dist`).
4. Add `VITE_ADMIN_PASSWORD` under Site settings → Environment variables.
5. Deploy.

### Option C — Any static host (e.g. your own server, GitHub Pages)
1. Run `npm run build` locally.
2. Upload the contents of the `dist/` folder to your host.
3. Since this is a single-page app, configure your host to serve
   `index.html` for all routes (Vercel/Netlify configs above already do
   this; other hosts may need similar rewrite rules).

## Where things are
- `src/App.jsx` — the dashboard itself (prices, users, services, overview)
- `src/PasswordGate.jsx` — temporary password screen, replace before going live
- `.env.example` — copy to `.env.local` to set your local password
- `vercel.json` / `netlify.toml` — hosting configs, already set up
