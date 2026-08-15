# Sphere Marketplace

A dark-themed, glassmorphism marketplace site for African sellers — with a
real affiliate program ($1 per referred seller) and an admin back office,
built on a real backend (Supabase + Postgres + Row Level Security, with a
Stripe Connect payout path).

## Structure

```
index.html                          — main site (search bar in top nav, referral capture, signup flow)
affiliate.html                      — affiliate signup + live dashboard
admin.html                          — admin back office (real login, platform stats, payouts)
assets/style.css                    — shared design system (all pages)
assets/app.js                       — Supabase data client (⚠️ needs your project URL + anon key — see below)
assets/admin-auth.js                — real admin authentication (Supabase Auth)
backend/supabase/schema.sql         — full Postgres schema + Row Level Security policies
backend/supabase/functions/         — edge functions: referral click/signup tracking, Stripe payout
backend/README.md                   — step-by-step go-live checklist
```

## Before this is live

The frontend is finished and battle-tested, but it needs your own backend
credentials to actually store data and money — **that's a few steps only
you can do** (create a Supabase project, run one SQL file, paste two keys).
Full walkthrough: **[`backend/README.md`](backend/README.md)**.

Until those steps are done, every page shows a small amber banner
("Backend not connected yet") and gracefully explains what's missing rather
than pretending to work — nothing breaks, nothing fakes data.

## Deploy to GitHub Pages

Once `assets/app.js` has your real Supabase URL/key:

1. Push this whole folder to `bugdata-commits/sphere-marketplace` (repo root).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch.**
   Branch `main`, folder `/ (root)`. Save.
3. Live at `https://bugdata-commits.github.io/sphere-marketplace/` within a
   minute or two.

Because this is a static frontend calling Supabase's API directly, GitHub
Pages is genuinely sufficient hosting here — no separate server needed.

## What's real vs. what needs one more step

| Piece | Status |
|---|---|
| Site, search, categories, pricing, etc. | ✅ Done |
| Affiliate signup, referral links, click/signup tracking | ✅ Real, once Supabase is connected (backend/README.md §1–4) |
| Admin login | ✅ Real Supabase Auth, not a password string (§6) |
| Admin dashboard (stats, affiliates, activity) | ✅ Real, RLS-protected |
| $1 payouts | ⚠️ Needs Stripe Connect + affiliate bank onboarding (§7) — intentionally does not fake a payment |

## Editing

- Visual design (colors, spacing, type): `assets/style.css`, tokens at the
  top of the `:root` block.
- Referral bounty amount: currently $1, set in **two** places that must
  match — `assets/app.js` (`REFERRAL_BOUNTY`) and
  `backend/supabase/functions/record-referral-signup/index.ts`
  (`REFERRAL_BOUNTY_CENTS`).
