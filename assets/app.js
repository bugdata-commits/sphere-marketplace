// ============================================================
// Trade Sphere Marketplace — app.js
// Handles: dynamic listings, category counts, search/filter,
// real auth (signup/signin), and affiliate link generation.
// Requires supabase-client.js loaded first.
// ============================================================

let currentUser = null;
let allListings = [];
let allCategories = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (!isSupabaseConfigured) {
    showConfigBanner();
    return;
  }

  await loadSession();
  await Promise.all([loadCategories(), loadListings()]);
  wireSearch();
  wireAuthForms();
  handleReferralParam();
});

// ---------- Config banner (dev-mode notice) -----------------
function showConfigBanner() {
  const banner = document.createElement("div");
  banner.className = "config-banner";
  banner.textContent =
    "Backend not connected yet — add your Supabase URL and anon key in assets/supabase-client.js";
  document.body.prepend(banner);
}

// ---------- Session -------------------------------------------
async function loadSession() {
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  updateNavForSession();
}

function updateNavForSession() {
  const signInLink = document.querySelector("[data-nav='signin']");
  const startSellingLink = document.querySelector("[data-nav='start-selling']");
  if (!signInLink) return;

  if (currentUser) {
    signInLink.textContent = "Sign out";
    signInLink.onclick = async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.reload();
    };
    if (startSellingLink) {
      startSellingLink.textContent = "Seller dashboard";
      startSellingLink.href = "seller-dashboard.html";
    }
  }
}

// ---------- Categories ------------------------------------------
async function loadCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");
  if (error) return console.error(error);
  allCategories = data;

  const select = document.querySelector("#category-filter");
  if (select) {
    data.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  }
}

// ---------- Listings ---------------------------------------------
async function loadListings() {
  const grid = document.querySelector("#listings-grid");
  if (!grid) return;

  const { data, error } = await supabase
    .from("listings")
    .select("*, profiles(business_name, full_name, verified), categories(name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    grid.innerHTML = `<p class="empty-state">Couldn't load listings right now. Please refresh.</p>`;
    return;
  }

  allListings = data;
  renderListings(allListings);
}

function renderListings(listings) {
  const grid = document.querySelector("#listings-grid");
  if (!grid) return;

  if (!listings.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <p><strong>No listings yet.</strong></p>
        <p>Be the first to list a product or service on the Sphere.</p>
        <a class="btn-primary" href="seller-dashboard.html">Start selling</a>
      </div>`;
    return;
  }

  grid.innerHTML = listings
    .map((l) => {
      const sellerName =
        l.profiles?.business_name || l.profiles?.full_name || "Seller";
      const verified = l.profiles?.verified
        ? `<span class="badge-verified">✓ Verified</span>`
        : "";
      const image = l.image_url || "assets/placeholder-listing.png";
      const price = l.price
        ? `${l.currency} ${Number(l.price).toLocaleString()}`
        : "Contact for price";

      return `
        <article class="listing-card">
          <div class="listing-image" style="background-image:url('${escapeHtml(image)}')"></div>
          <div class="listing-body">
            <div class="listing-rating">★ ${l.rating || "New"} ${
        l.review_count ? `(${l.review_count})` : ""
      }</div>
            <h3>${escapeHtml(l.title)}</h3>
            <p class="listing-seller">${escapeHtml(sellerName)} ${verified}</p>
            <p class="listing-price">${price}</p>
            <p class="listing-location">${escapeHtml(l.location || "")}</p>
          </div>
        </article>`;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- Search / filter ---------------------------------------
function wireSearch() {
  const searchInput = document.querySelector("#search-input");
  const categorySelect = document.querySelector("#category-filter");

  function applyFilters() {
    const q = (searchInput?.value || "").toLowerCase().trim();
    const catId = categorySelect?.value;

    let filtered = allListings;
    if (q) {
      filtered = filtered.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description || "").toLowerCase().includes(q)
      );
    }
    if (catId) {
      filtered = filtered.filter((l) => String(l.category_id) === catId);
    }
    renderListings(filtered);
  }

  searchInput?.addEventListener("input", applyFilters);
  categorySelect?.addEventListener("change", applyFilters);
}

// ---------- Auth: signup / signin ------------------------------------
function wireAuthForms() {
  const signupForm = document.querySelector("#signup-form");
  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = signupForm.querySelector("[name='full_name']").value;
    const email = signupForm.querySelector("[name='email']").value;
    const password = signupForm.querySelector("[name='password']").value;
    const role = signupForm.querySelector("[name='role']")?.value || "seller";

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });

    const feedback = document.querySelector("#signup-feedback");
    if (error) {
      if (feedback) feedback.textContent = error.message;
      return;
    }
    recordReferralIfPresent(email);
    document.querySelector("#signup-step-form")?.classList.add("hidden");
    document.querySelector("#signup-step-success")?.classList.remove("hidden");
  });

  const signinForm = document.querySelector("#signin-form");
  signinForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = signinForm.querySelector("[name='email']").value;
    const password = signinForm.querySelector("[name='password']").value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    const feedback = document.querySelector("#signin-feedback");
    if (error) {
      if (feedback) feedback.textContent = error.message;
      return;
    }
    window.location.href = "seller-dashboard.html";
  });
}

// ---------- Affiliate referral tracking ------------------------------
function handleReferralParam() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) sessionStorage.setItem("sphere_ref", ref);
}

async function recordReferralIfPresent(referredEmail) {
  const refId = sessionStorage.getItem("sphere_ref");
  if (!refId) return;
  await supabase.from("referrals").insert({
    referrer_id: refId,
    referred_email: referredEmail,
  });
  sessionStorage.removeItem("sphere_ref");
}

// Exposed for affiliate.html to build a logged-in user's referral link
async function getMyReferralLink() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const base = window.location.origin + window.location.pathname.replace("affiliate.html", "");
  return `${base}?ref=${user.id}`;
}
