# Sphere Marketplace — backend setup (go live)

This turns the affiliate program and admin back office from a demo into a
real system: a real Postgres database, real server-enforced referral
crediting, real admin login, and (once you add Stripe) real $1 payouts.

Everything here is written and ready — the steps below are the handful of
things only you can do (create accounts, paste two keys, run one SQL file).

---

## 1. Create your Supabase project (~5 minutes)

1. Go to https://supabase.com → New project.
2. Pick a name, database password (save it somewhere safe), and region
   (choose one close to your users — e.g. an EU or US region with good
   latency to Africa, since Supabase doesn't yet have an African region).
3. Wait for the project to finish provisioning.

## 2. Run the database schema

1. In your Supabase project: **SQL Editor → New query**.
2. Paste the entire contents of `backend/supabase/schema.sql` and run it.
3. Confirm in **Table Editor** that you now have: `affiliates`,
   `referral_events`, `payouts`, `admin_users`, and a view `affiliate_public`.

## 3. Connect the frontend to your project

1. In Supabase: **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key (not the service
   role key — that one stays server-side only, see step 5).
3. Open `assets/app.js` and replace the two placeholders at the top:
   ```js
   const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
   ```
4. The yellow "Backend not connected" banner disappears once these are set.

## 4. Deploy the edge functions

These run the logic that can't be trusted to the browser (crediting
referrals, triggering payouts). You'll need the Supabase CLI:

```
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy record-referral-click
supabase functions deploy record-referral-signup
supabase functions deploy pay-affiliate
```

## 5. Set function secrets

The edge functions need the **service role key** (Project Settings → API →
`service_role` secret — keep this one truly secret, never put it in
frontend code) so they can write to the database on the server side:

```
supabase secrets set SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 6. Create your first admin account

1. In Supabase: **Authentication → Users → Add user**. Create an account
   with your admin's real email and a password (or invite them via email —
   Supabase supports both).
2. Copy that user's **UID** from the Users table.
3. Back in **SQL Editor**, run:
   ```sql
   insert into admin_users (user_id, role) values ('paste-the-uid-here', 'superadmin');
   ```
4. That person can now sign in at `/admin.html` with their real email and
   password. Add more admins the same way (use role `'admin'` for
   non-superadmins — see the RLS policies in `schema.sql` for what each
   role can do).

At this point: the affiliate signup flow, referral tracking, and admin
dashboard are all backed by a real database with real access control.

---

## 7. (Optional, when you're ready to pay real money) Connect Stripe

The $1 payouts are **not live** until you do this — until then, the admin
dashboard will show balances owed but the "Pay via Stripe" button will
return an error, by design, rather than pretend to pay someone.

1. Create a Stripe account and enable **Stripe Connect**
   (https://dashboard.stripe.com/connect/overview) — this is what lets you
   send money to third parties (your affiliates), not just accept payments.
2. Decide your Connect flow: the standard approach is **Express accounts**,
   where each affiliate completes a short Stripe-hosted onboarding (identity
   verification, bank details) before they can receive a payout. This is a
   real KYC flow — Stripe requires it before releasing funds, and you'll
   want it regardless for tax/compliance reasons once real money is moving.
3. Add a `stripe_account_id` column (the function file has the one-line SQL
   for this) and build a small "Connect your bank account" button on the
   affiliate dashboard that redirects to Stripe's onboarding link
   (`stripe.accounts.create` + `stripe.accountLinks.create` — see Stripe's
   Connect onboarding docs for the exact calls).
4. Set the function secret:
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_live_your_key
   ```
5. Once an affiliate has completed onboarding, "Pay via Stripe" in the admin
   dashboard will trigger a real transfer via `backend/supabase/functions/pay-affiliate`.

**Before turning real payouts on for anyone, also decide:**
- A minimum payout threshold (e.g. don't transfer until $10+ is owed —
  Stripe charges small fees per transfer, and this avoids sending 40 cents).
- How you'll handle tax forms once an affiliate crosses reporting thresholds
  in their country — this varies a lot by jurisdiction, worth a quick word
  with an accountant before you're paying dozens of people.
- Fraud rules beyond the basic duplicate-email check already in
  `record-referral-signup` — e.g. rate-limiting by IP, flagging affiliates
  whose referred "signups" never do anything on the platform afterward.

---

## What's already handled for you

- **Referral crediting can't be faked from the browser.** The $1 credit only
  ever happens inside `record-referral-signup`, which runs server-side with
  the service role key. A browser can never INSERT a credit directly —
  Row Level Security blocks it.
- **Admin access is real auth**, not a password string in JavaScript. Every
  admin-only read/write is checked against the `admin_users` table via
  Postgres RLS, using the signed-in admin's own JWT.
- **Money movement is admin-gated twice over**: the `pay-affiliate` function
  checks the caller's JWT against `admin_users` before doing anything, and
  Stripe itself won't transfer to an affiliate who hasn't completed
  onboarding.
