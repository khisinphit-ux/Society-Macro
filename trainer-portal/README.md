# Personal Training Client Portal

A multi-client web app for personal trainers. Each client logs in and sees their own:

1. **Macros** — daily targets (set by trainer), per-meal logging, food search, weekly summary chart
2. **Food Journal** — free-text journal entries by date
3. **Body Fat** — body-fat % chart over time, skinfold (Jackson-Pollock) calculator, weight log, progress photos

The trainer logs in to the same site and sees a dashboard of all their clients, can add new clients, set macro targets, and view each client's data.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + serverless backend
- **Supabase** — Postgres database, authentication, file storage (for progress photos), and Row-Level Security so clients can never see each other's data
- **Tailwind CSS** — styling
- **Recharts** — charts

All hosted free: Vercel (Next.js) + Supabase free tier.

---

## Setup (one-time, ~20 minutes)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, create a new project. Save the database password.
2. In the Supabase dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql`, and click **Run**. This creates every table and security policy.
3. Open **Storage** → create a new bucket named `progress-photos`. Set it to **Private**.
4. Run the policies in `supabase/storage-policies.sql` from the SQL Editor as well.
5. Copy your project URL and anon key from **Settings → API**.

### 2. Configure the app

```bash
cp .env.example .env.local
```

Open `.env.local` and paste in:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # for inviting clients
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### 4. Create your trainer account

1. Sign up at `/signup` with your email.
2. In Supabase **Table Editor → profiles**, find your user row and change `role` from `client` to `trainer`. (You only need to do this once for yourself.)
3. Log out and log back in — you'll land on `/trainer`.

### 5. Add a client

From the trainer dashboard, click **Add Client**, enter their email and name. They'll be created with a temporary password that you share with them. They can change it after first login.

### 6. Deploy

Push the repo to GitHub, import it into Vercel, paste the same three env vars into Vercel's project settings. Done.

---

## Project layout

```
app/
  (auth)/login          login + signup pages
  (auth)/signup
  trainer/              trainer dashboard
    page.tsx              client list
    [clientId]/page.tsx   single client detail + targets
  portal/               client portal
    page.tsx              redirects to /portal/macros
    macros/page.tsx       macro counter + food log
    journal/page.tsx      food journal
    bodyfat/page.tsx      body fat tab
  api/
    invite-client/        POST: trainer invites a new client
components/             shared UI
lib/
  supabase/             server + browser clients
  bodyfat.ts            Jackson-Pollock 3-site formula
supabase/
  schema.sql
  storage-policies.sql
```

## What you'd add later

- Email-based client invites (currently uses temp password — easy to swap to magic link)
- Mobile app shell (the web app already works on phones; a PWA wrapper takes ~1 hour)
- Workout programming tab
- Stripe billing if you want to charge per client
- Push reminders for daily logging

---

## Notes for the trainer (you)

- The food database starts empty. Add foods from the trainer dashboard, or import a CSV. A small starter list of ~30 common foods is included in `supabase/seed-foods.sql`.
- Body-fat % is calculated using the **Jackson-Pollock 3-site formula** (chest, abdomen, thigh for men; tricep, suprailiac, thigh for women). You can switch formulas in `lib/bodyfat.ts`.
- Progress photos are private — only the client and their trainer can view them, enforced at the database level by RLS policies.
