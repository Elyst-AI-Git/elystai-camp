# Camp

Camp is the shared daily operating loop for Nihal and Shirin. Today is the daily work surface; Calendar owns event planning; Money owns the cash view; Review owns sprint and weekly check-ins. The app keeps the warm cream/candy visual language and uses the supplied profile and character illustrations.

```bash
npm install
npm run dev -- --port 3001
```

For a production-style local preview after `npm run build`, use `npm run start -- --port 3001`.

For Supabase-backed local development, copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. `.env.local` is git-ignored. Run `supabase/migrations/0001_init.sql`, then `0002_weekly_goals.sql`, `0003_category_values.sql`, `0004_content_metric_keys.sql`, and `0005_upskilling_category.sql`, in the Supabase SQL editor (or with the Supabase CLI) before signing in. Public sign-up is intentionally not part of Camp.

The mock seed in `lib/mock/data.ts` is intentionally empty for a clean workspace. In no-env preview mode the React Context uses a try/catch-wrapped `camp-clean-v2-*` localStorage cache as a temporary shim; the previous demo cache is not read. Supabase becomes the source of truth as soon as the public URL and anon key are present. Task, finance, calendar, metric, sprint, slip-reason, daily-hours, rest-day, and weekly-goal mutations live in `lib/data/`, check Supabase errors, and show generic UI errors. In local preview, click either lane header to inspect Nihal or Shirin; the signed-in build derives the profile from the authenticated email. Today includes sprint switching, task entry, per-person hours, rest days, two-week consistency, and weekly goals. The service-role client in `lib/supabase/admin.ts` is server-only and is not imported by client code.

The migrations are in `supabase/migrations/`; run them in filename order. They enable RLS and add the live tables to Supabase Realtime when the managed `supabase_realtime` publication is available. Never commit `.env.local` or the service-role key.

Before production, add the Supabase URL and keys to the environment (service role on the server only), run the migration, and confirm the two auth users and production redirect URL. Then enter the real balance/as-of date, AED and USD rates, recent transactions, invoices, reimbursements, active sprint/tasks, and calendar blocks. Replace or approve the eight avatar state assets, then smoke-test both accounts in separate browsers for task, finance, calendar, and realtime behaviour. Hosted RLS, foreign-key, realtime, and email-template checks still require access to the live Supabase project.
