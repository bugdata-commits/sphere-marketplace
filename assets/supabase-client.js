// ============================================================
// Supabase connection — fill these in from:
// Supabase Dashboard → Project Settings → API
// ============================================================
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL"; // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Loaded from the Supabase CDN script tag in index.html / seller-dashboard.html
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const isSupabaseConfigured =
  SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
