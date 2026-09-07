# Sphere Marketplace — Supabase upgrade

## What changed
- Removed the four hardcoded demo listings (Solar Kit, Kente Jacket, etc.) — the marketplace grid now loads real listings from Supabase, with an empty state until sellers publish.
- Added real accounts: sign up / sign in now use Supabase Auth (not the fake demo modal).
- Added `seller-dashboard.html` — sellers can publish, mark sold, and delete their own listings. This didn't exist before; it's the missing piece that made the old site a static demo.
- Added search + category filtering wired to real data.
- Added referral tracking: an affiliate's link (`?ref=<user-id>`) is stored and recorded in a `referrals` table on signup.
- Row Level Security is on for every table — sellers can only edit their own listings, buyers can only read active ones.

## Setup (10 minutes)

1. **Create a Supabase project** at supabase.com if you haven't already.
2. **Run the schema**: Supabase Dashboard → SQL Editor → New query → paste the contents of `supabase-schema.sql` → Run.
3. **Get your API keys**: Project Settings → API → copy the *Project URL* and *anon public* key.
4. **Configure the site**: open `assets/supabase-client.js` and paste them in place of `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY`.
5. **Enable email auth**: Authentication → Providers → make sure Email is on. For a fast launch, turn off "Confirm email" under Authentication → Settings so new sellers can sign in immediately (you can turn it back on once you set up email templates).
6. **Push to GitHub**: replace the files in `bugdata-commits/sphere-marketplace` with these, commit, and push to the branch GitHub Pages serves.

## Not yet wired (next steps)
- `affiliate.html` — the existing page's copy can stay, but its "Get my referral link" button should call `getMyReferralLink()` from `app.js` once the affiliate is signed in, and show a payout log from the `referrals` table. Happy to wire this next.
- Stripe Connect payouts for affiliates and escrow checkout — the schema has a `payout_amount` column ready for it, but actual payment processing needs a Supabase Edge Function calling Stripe (can't run in a static GitHub Pages site alone).
- Image uploads — listings currently take an image URL; Supabase Storage can replace this with real uploads when you're ready.

## A note on GitHub Pages + Supabase
This stays a fully static site — Supabase's anon key is meant to be public (security lives in the Row Level Security policies in the schema, not in hiding the key). No server needed, so GitHub Pages hosting still works exactly as before.
