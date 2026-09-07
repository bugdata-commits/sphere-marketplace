(function () {
  const SUPABASE_URL = 'https://eqvunpxereqqqgumotid.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_pIKmOBGR-Jyyih5D6rHV5A_C7BxYpGU';

  async function signUp(email, password, name) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, data: { full_name: name, role: 'seller' } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.message || ('Signup failed (' + res.status + ')'));
    return data;
  }

  async function signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.message || ('Sign in failed (' + res.status + ')'));
    return data;
  }

  window.SupabaseDirectAuth = { signUp, signIn };
})();
