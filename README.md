# Tafasa Agrotech — Admin Dashboard (connected to Supabase)

This version reads and writes real data from a Supabase backend instead of
mock in-memory arrays. Set up the backend first (see the `tafasa-backend`
project's README and `supabase/schema.sql`), then come back here.

## 1. Configure environment
```
cp .env.example .env.local
```
Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase
project (Project Settings -> API).

## 2. Install & run locally
```
npm install
npm run dev
```
Open http://localhost:5173. You'll be asked to sign in — use the admin
email/password you created in Supabase (Authentication -> Users), after
linking that user in the `admins` table (see backend README, step 3).

## What's connected
- **Prices tab**: reads `price_aggregates`, edits write straight back to
  the same table. The flagged-reports queue reads/writes `price_reports`.
- **Users tab**: verification queue reads/writes `user_verifications`;
  trust scores read/write `user_trust`.
- **Services tab**: reads `service_requests` and `service_providers`,
  assigning/completing writes back to `service_requests`.
- **Login**: real Supabase Auth, checked against the `admins` table via
  Row Level Security — not just a frontend password screen.

## Known simplifications (fine for a pilot, revisit before real scale)
- Approving a flagged price report marks it reviewed but doesn't yet
  automatically recompute `price_aggregates` — that's a good candidate for
  a Supabase Edge Function or scheduled job next.
- Approving a user verification doesn't yet provision their live account —
  wire this up once the farmer/buyer app has real accounts tied to
  Supabase Auth (currently it uses a mock OTP screen).

## Admin tiers: regular vs super admin
Every admin (anyone in the `admins` table) can edit prices, review
verifications, adjust trust scores, and assign services. But **only a
super admin can add or remove other admins** — this is enforced at the
database level, not just hidden in the UI.

To set this up:
1. Run `supabase/migrations/003_super_admin.sql` in the SQL Editor (after
   `schema.sql` and `002_profiles.sql`).
2. Make yourself the super admin — run this separately, with your own email:
   ```sql
   update admins set is_super_admin = true where email = 'your-email@example.com';
   ```
Without step 2, nobody (not even you) can add or remove admins, since the
security rules only allow writes from someone already marked as super
admin.

Once you're set up, an **"Admins" tab appears in the sidebar for you only**
— regular admins won't see it. From there you can add a new admin (after
creating their login in Supabase Authentication → Users, paste their User
UID + email), remove one, or click an admin's badge to **promote them to
super admin or demote them back to regular admin**. You can't change your
own super-admin status from the UI — this stops you from accidentally
locking yourself out; ask another super admin if you ever need to change it.

## My account (all admins)
Every admin — regular or super — has a **"My account" tab** to change
their own password, without needing to go into Supabase's dashboard. This
calls Supabase Auth directly and doesn't require re-entering the old
password (since you're already signed in), just a new one twice for
confirmation.


## Deploying
Same as before — Vercel or Netlify (configs already in this project).
Just make sure to add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
environment variables in your hosting dashboard, not just `.env.local`.
