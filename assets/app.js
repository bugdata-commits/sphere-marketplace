/*
  Sphere Marketplace — data layer (production).

  This talks to a real Supabase backend. Fill in the two values below after
  you create your Supabase project (see backend/README.md) — everything else
  in this file works as-is against the schema in backend/supabase/schema.sql.

  Nothing sensitive lives in this file: the anon key is meant to be public
  (it's what every Supabase frontend ships), and all money-moving logic runs
  server-side in the edge functions, protected by Row Level Security.
*/

const SUPABASE_URL = 'https://eqvunpxereqqqgumotid.supabase.co';   // ← replace
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdnVucHhlcmVxcXFndW1vdGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDYxODksImV4cCI6MjEwMjI4MjE4OX0.BYsL96Kru2iNcL42JKImzz7WTrzkx2e98-2ONgFTb6I';               // ← replace

const SphereDB = (() => {
  const ACTIVE_REF_KEY = 'sphere_active_ref';
  const REFERRAL_BOUNTY = 1.00; // $1 — must match REFERRAL_BOUNTY_CENTS in the edge function

  const configured = !SUPABASE_URL.includes('YOUR-PROJECT-REF');

  function warnIfUnconfigured() {
    if (!configured) {
      console.warn(
        'SphereDB: Supabase is not configured yet — set SUPABASE_URL and ' +
        'SUPABASE_ANON_KEY at the top of assets/app.js. See backend/README.md.'
      );
    }
    return configured;
  }

  async function restQuery(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: options.prefer || 'return=representation',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function callFunction(name, body) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  function makeCode(name) {
    const base = (name || 'seller').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'seller';
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${base}-${suffix}`;
  }

  async function createAffiliate(name, email) {
    if (!warnIfUnconfigured()) return null;
    const code = makeCode(name);
    const [row] = await restQuery('affiliates', {
      method: 'POST',
      body: JSON.stringify([{ code, name: name || 'Unnamed seller', email }]),
    });
    localStorage.setItem('sphere_my_code', code);
    return normalizeAffiliate(row);
  }

  function normalizeAffiliate(row) {
    if (!row) return null;
    return {
      code: row.code,
      name: row.name,
      email: row.email,
      clicks: row.clicks,
      signups: row.signups,
      balance: (row.balance_cents ?? 0) / 100,
      paidOut: (row.paid_cents ?? 0) / 100,
    };
  }

  async function getMyAffiliate() {
    const code = localStorage.getItem('sphere_my_code');
    if (!code) return null;
    return getAffiliate(code);
  }

  async function getAffiliate(code) {
    if (!warnIfUnconfigured()) return null;
    const rows = await restQuery(`affiliate_public?code=eq.${encodeURIComponent(code)}`);
    return rows && rows[0] ? normalizeAffiliate(rows[0]) : null;
  }

  async function listAffiliates() {
    if (!warnIfUnconfigured()) return [];
    const rows = await restQuery('affiliate_public?order=balance_cents.desc');
    return rows.map(normalizeAffiliate);
  }

  // Admin view: full affiliate rows (includes email), gated by RLS via the
  // admin's own access token — the anon key alone cannot read this.
  async function listAffiliatesAsAdmin(accessToken) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?order=balance_cents.desc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Admin fetch failed: ${res.status}`);
    const rows = await res.json();
    return rows.map(r => ({ ...normalizeAffiliate(r), id: r.id }));
  }

  async function listEventsAsAdmin(accessToken, limit = 40) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/referral_events?order=created_at.desc&limit=${limit}`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Admin fetch failed: ${res.status}`);
    return res.json();
  }

  // Call on every page load to capture ?ref=CODE
  async function captureReferralFromURL() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return;
    sessionStorage.setItem(ACTIVE_REF_KEY, ref);

    const seenKey = `sphere_click_seen_${ref}`;
    if (!sessionStorage.getItem(seenKey) && configured) {
      try {
        await callFunction('record-referral-click', { referralCode: ref });
      } catch (e) {
        console.warn('Could not record referral click:', e);
      }
      sessionStorage.setItem(seenKey, '1');
    }
  }

  // Call when a visitor completes the "Start Selling" signup.
  // The actual crediting decision happens server-side (edge function) —
  // this is intentionally the only way a signup can earn someone $1.
  async function recordSignup(sellerName, sellerEmail) {
    const ref = sessionStorage.getItem(ACTIVE_REF_KEY) || null;
    if (!warnIfUnconfigured()) return { credited: false, ref };
    const result = await callFunction('record-referral-signup', {
      referralCode: ref,
      sellerName,
      sellerEmail,
    });
    return { credited: !!result.credited, ref };
  }

  // Admin-only action — requires a Supabase Auth access token (see
  // assets/admin-auth.js). RLS + the function's own admin check reject
  // this otherwise, so a demo password alone can never trigger a payout.
  async function markPaid(affiliateId, accessToken) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/pay-affiliate`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ affiliateId }),
    });
    return res.json();
  }

  async function totals() {
    const affiliates = await listAffiliates();
    return {
      affiliateCount: affiliates.length,
      totalClicks: affiliates.reduce((s, a) => s + a.clicks, 0),
      totalSignups: affiliates.reduce((s, a) => s + a.signups, 0),
      totalOwed: +affiliates.reduce((s, a) => s + a.balance, 0).toFixed(2),
      totalPaid: +affiliates.reduce((s, a) => s + a.paidOut, 0).toFixed(2),
    };
  }

  function referralLink(code) {
    const url = new URL(window.location.href);
    url.search = '';
    url.pathname = url.pathname.replace(/(affiliate|admin)\.html$/, 'index.html');
    url.searchParams.set('ref', code);
    return url.toString();
  }

  return {
    createAffiliate, getMyAffiliate, getAffiliate, listAffiliates,
    listAffiliatesAsAdmin, listEventsAsAdmin,
    captureReferralFromURL, recordSignup, markPaid, totals, referralLink,
    REFERRAL_BOUNTY, isConfigured: () => configured,
  };
})();
