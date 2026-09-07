/*
  Trade Sphere Marketplace — merged production app.js
  Premium UI + real Supabase backend + affiliate program + auth.
*/

const SUPABASE_URL = 'https://eqvunpxereqqqgumotid.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pIKmOBGR-Jyyih5D6rHV5A_C7BxYpGU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SphereDB = (() => {
  const ACTIVE_REF_KEY = 'sphere_active_ref';
  const REFERRAL_BOUNTY = 1.00;

  const configured = true;

  function warnIfUnconfigured() {
    if (!configured) {
      console.warn('SphereDB: Supabase is not configured yet.');
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
    url.pathname = url.pathname.replace(/(affiliate|admin|seller-dashboard)\.html$/, 'index.html');
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

// ---------- Categories ------------------------------------------
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');
  if (error) return console.error(error);
  window.__allCategories = data || [];
  const select = document.querySelector('#category-filter');
  if (select && data) {
    data.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  }
}

// ---------- Listings ---------------------------------------------
async function loadListings() {
  const grid = document.querySelector('#listings-grid, #live-listings');
  if (!grid) return;
  const { data, error } = await supabase
    .from('listings')
    .select('*, profiles(business_name, full_name, verified), categories(name)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    grid.innerHTML = '<p class="empty-state">Couldn\'t load listings right now. Please refresh.</p>';
    return;
  }
  window.__allListings = data || [];
  renderListings(window.__allListings);
}

function renderListings(listings) {
  const grid = document.querySelector('#listings-grid, #live-listings');
  if (!grid) return;
  if (!listings.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <p><strong>No listings yet.</strong></p>
        <p>Be the first to list a product or service on the Sphere.</p>
        <a class="btn btn-primary" href="seller-dashboard.html">Start selling</a>
      </div>`;
    return;
  }
  grid.innerHTML = listings
    .map((l) => {
      const sellerName = l.profiles?.business_name || l.profiles?.full_name || 'Seller';
      const verified = l.profiles?.verified ? `<span class="badge-verified">✓ Verified</span>` : '';
      const price = l.price ? `${l.currency || '$'} ${Number(l.price).toLocaleString()}` : 'Contact for price';
      const article = document.createElement('article');
      article.className = 'listing-card';
      const imageDiv = document.createElement('div');
      imageDiv.className = 'listing-image';
      // Set via the CSSOM (not string interpolation) so an untrusted image_url
      // can never break out of a quoted attribute or inject extra CSS/HTML.
      imageDiv.style.backgroundImage = `url(${CSS.escape(sanitizeImageUrl(l.image_url))})`;
      article.appendChild(imageDiv);
      const body = document.createElement('div');
      body.className = 'listing-body';
      body.innerHTML = `
        <div class="listing-rating">★ ${escapeHtml(String(l.rating || 'New'))} ${l.review_count ? `(${escapeHtml(String(l.review_count))})` : ''}</div>
        <h3>${escapeHtml(l.title)}</h3>
        <p class="listing-seller">${escapeHtml(sellerName)} ${verified}</p>
        <p class="listing-price">${escapeHtml(price)}</p>
        <p class="listing-location">${escapeHtml(l.location || '')}</p>`;
      article.appendChild(body);
      return article.outerHTML;
    })
    .join('');
}

// Only allow http(s) image URLs (blocks javascript:/data:/vbscript: payloads);
// falls back to a same-origin placeholder for anything else or a missing value.
function sanitizeImageUrl(url) {
  const fallback = 'assets/placeholder-listing.png';
  if (!url) return fallback;
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Search / filter ---------------------------------------
function wireSearch() {
  const searchInput = document.querySelector('#search-input');
  const categorySelect = document.querySelector('#category-filter');
  function applyFilters() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const catId = categorySelect?.value;
    let filtered = window.__allListings || [];
    if (q) {
      filtered = filtered.filter(
        (l) => l.title.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q)
      );
    }
    if (catId) {
      filtered = filtered.filter((l) => String(l.category_id) === catId);
    }
    renderListings(filtered);
  }
  searchInput?.addEventListener('input', applyFilters);
  categorySelect?.addEventListener('change', applyFilters);
}

// ---------- Auth: signup / signin ----------------------------------
async function wireAuthForms() {
  const signupForm = document.querySelector('#signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = signupForm.querySelector("[name='full_name']").value;
      const email = signupForm.querySelector("[name='email']").value;
      const password = signupForm.querySelector("[name='password']").value;
      const role = signupForm.querySelector("[name='role']")?.value || 'seller';
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role } },
      });
      const feedback = document.querySelector('#signup-feedback');
      if (error) {
        if (feedback) feedback.textContent = error.message;
        return;
      }
      await SphereDB.recordSignup(fullName, email);
      document.querySelector('#signup-step-form')?.classList.add('hidden');
      document.querySelector('#signup-step-success')?.classList.remove('hidden');
    });
  }

  const signinForm = document.querySelector('#signin-form');
  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = signinForm.querySelector("[name='email']").value;
      const password = signinForm.querySelector("[name='password']").value;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      const feedback = document.querySelector('#signin-feedback');
      if (error) {
        if (feedback) feedback.textContent = error.message;
        return;
      }
      window.location.href = 'seller-dashboard.html';
    });
  }
}

// ---------- Affiliate referral tracking ------------------------------
function handleReferralParam() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) sessionStorage.setItem('sphere_ref', ref);
}

async function recordReferralIfPresent(referredEmail) {
  const refId = sessionStorage.getItem('sphere_ref');
  if (!refId) return;
  await supabase.from('referrals').insert({
    referrer_id: refId,
    referred_email: referredEmail,
  });
  sessionStorage.removeItem('sphere_ref');
}

// Exposed for affiliate.html to build a logged-in user's referral link
async function getMyReferralLink() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const base = window.location.origin + window.location.pathname.replace('affiliate.html', '');
  return `${base}?ref=${user.id}`;
}

// ---------- Init ----------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.__supabaseConfigured && typeof isSupabaseConfigured !== 'undefined' && !isSupabaseConfigured) {
    const banner = document.createElement('div');
    banner.className = 'config-banner';
    banner.textContent = 'Backend not connected yet — add your Supabase URL and anon key in assets/app.js';
    document.body.prepend(banner);
    return;
  }
  window.__supabaseConfigured = true;
  await loadSession();
  await Promise.all([loadCategories(), loadListings()]);
  wireSearch();
  // wireAuthForms disabled; old index.html handles auth via inline script
  handleReferralParam();
  SphereDB.captureReferralFromURL();
});

async function loadSession() {
  const { data } = await supabase.auth.getSession();
  window.__currentUser = data.session?.user || null;
  updateNavForSession();
}

function updateNavForSession() {
  const signInLink = document.querySelector("[data-nav='signin']");
  const startSellingLink = document.querySelector("[data-nav='start-selling']");
  if (!signInLink) return;
  if (window.__currentUser) {
    signInLink.textContent = 'Sign out';
    signInLink.onclick = async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.reload();
    };
    if (startSellingLink) {
      startSellingLink.textContent = 'Seller dashboard';
      startSellingLink.href = 'seller-dashboard.html';
    }
  }
}
