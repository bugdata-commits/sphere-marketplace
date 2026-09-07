# Sphere Marketplace — deployment-readiness pass

## What changed this round

**Fixed bugs that would have broken deployment:**
- `affiliate.html` and `seller-dashboard.html` used CSS classes (`.nav`, `.eyebrow`, `.listing-card`, `.section`, etc.) that don't exist in `assets/style.css` — they would have deployed essentially unstyled. Both are rebuilt using the real header/nav/glass-card/button components from `index.html`.
- `affiliate.html` loaded both `assets/supabase-client.js` (placeholder credentials) *and* `assets/app.js` (real credentials) — both declared `const supabase`, which throws and breaks the whole page. `seller-dashboard.html` only loaded the placeholder file, so it was non-functional. `assets/supabase-client.js` is now deleted; `assets/app.js` is the single source of Supabase config, loaded on every page.
- `var(--text-dim)` was referenced in three places but never defined in `:root` — those elements would render with the wrong (inherited/default) color. Added as an alias for `--dim`.

**Accessibility (mobile-first):**
- Skip-to-content link, visible on keyboard focus.
- `:focus-visible` outlines added everywhere (there were none before).
- Tap targets bumped to the 44px minimum — hamburger, search toggle, buttons, mobile menu links, and the modal close button were all ~31px.
- Modals now trap focus, close on `Escape`, and return focus to whatever opened them.
- Real `<label>` elements replace placeholder-only / `aria-label`-only inputs across every form.
- `aria-live` regions on the toast and form feedback so screen readers announce status changes.
- `--dim` text color bumped slightly (#737870 → #7c8177) to clear WCAG AA contrast (was 4.42:1, needs 4.5:1).
- Added a `prefers-contrast: more` fallback.

**Security:**
- Strict Content-Security-Policy on every page. No inline scripts or event-handler attributes remain (`onsubmit`, `onclick` moved to external files, `assets/main.js` / `assets/dashboard.js` / `assets/affiliate.js`), so `script-src` needs no `'unsafe-inline'`.
- Supabase CDN script pinned to an exact version (`@2.115.0`) instead of a floating `@2`.
- `Referrer-Policy` and `X-Content-Type-Options` headers added.
- Listing image URLs are now validated (http/https only, blocks `javascript:`/`data:` payloads) and set via the CSSOM instead of string-interpolated into a `style` attribute, closing a CSS-injection gap.
- Row Level Security was already correctly configured in `supabase-schema.sql` — sellers can only write their own listings, buyers can only read active ones. No changes needed there.

**Blog:**
- New `/blog.html` index plus three articles (`blog-escrow-and-trust.html`, `blog-seller-tips.html`, `blog-pan-african-logistics.html`), styled with the same dark/glass/gold system as the rest of the site. Linked from the header nav, mobile menu, and footer everywhere.

## Removing the listed products

The code itself has **no hardcoded products** — `index.html`'s listings grid already pulls live from Supabase and shows an empty state until a seller publishes something. If you're still seeing demo products on the *currently deployed* site, those are real rows sitting in your Supabase `listings` table, not code — clearing them needs your Supabase credentials, which this build intentionally doesn't have admin access to (only the public anon key, restricted by RLS to each seller's own rows).

To clear them yourself: **Supabase Dashboard → SQL Editor → New query**, then run:

```sql
delete from public.listings;
```

That's it — the homepage will show the "No listings yet — be the first to publish on the Sphere" empty state immediately after.

## Setup / deploy (unchanged from before)

1. Schema and RLS are already applied if you ran `supabase-schema.sql` previously — no changes needed there.
2. `assets/app.js` already has your real Supabase project URL and anon key — nothing to fill in.
3. Push these files to `bugdata-commits/sphere-marketplace`, replacing what's there, and GitHub Pages will serve it as-is (still a fully static site, no server needed).

## Still not wired (unchanged from before)
- Stripe Connect payouts for affiliates and escrow checkout — schema has a `payout_amount` column ready, but real payment processing needs a Supabase Edge Function calling Stripe.
- Image uploads — listings currently take an image URL; Supabase Storage can replace this with real uploads later.
