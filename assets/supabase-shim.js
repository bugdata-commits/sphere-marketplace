(function () {
  if (window.__supabaseShimLoaded) return;
  window.__supabaseShimLoaded = true;

  const SUPABASE_URL = 'https://eqvunpxereqqqgumotid.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_pIKmOBGR-Jyyih5D6rHV5A_C7BxYpGU';
  const STORAGE_KEY = 'sb-eqvunpxereqqqgumotid-auth-token';

  async function rest(path, opts = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: opts.prefer || 'return=representation',
        ...(opts.headers || {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { const j = JSON.parse(text); msg = j.message || j.msg || text; } catch {}
      throw new Error(msg || ('Request failed (' + res.status + ')'));
    }
    return text ? JSON.parse(text) : null;
  }

  async function authRest(path, body) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.message || ('Auth failed (' + res.status + ')'));
    return data;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function refreshAccessToken() {
    const session = getSession();
    if (!session?.refresh_token) return null;
    try {
      const data = await authRest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      const newSession = { ...session, ...data };
      setSession(newSession);
      return newSession;
    } catch {
      clearSession();
      return null;
    }
  }

  async function getValidSession() {
    let session = getSession();
    if (!session) return { data: { session: null } };
    const expiresAt = (session.expires_at || 0) * 1000;
    if (Date.now() > expiresAt - 60000) {
      session = await refreshAccessToken();
    }
    return { data: { session } };
  }

  function table(name) {
    return {
      select: (cols = '*') => {
        const q = { path: `${name}?select=${encodeURIComponent(cols)}`, headers: {}, prefer: 'return=representation' };
        const chain = {
          eq: (col, val) => { q.path += `&${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`; return chain; },
          order: (col, opts = {}) => { const dir = opts.ascending !== false ? 'asc' : 'desc'; q.path += `&order=${encodeURIComponent(col)}.${dir}`; return chain; },
          then(resolve, reject) { return resolve(rest(q.path, { headers: q.headers, prefer: q.prefer })).catch?.(reject); },
          catch(onCatch) { return this.then(null, onCatch); },
        };
        return chain;
      },
      insert: (rows) => rest(name, { method: 'POST', body: JSON.stringify(rows), prefer: 'return=representation' }),
      update: (patch) => ({
        eq: async (col, val) => rest(name, {
          method: 'PATCH',
          body: JSON.stringify(patch),
          headers: { Prefer: 'return=representation' },
          url: `${SUPABASE_URL}/rest/v1/${name}?${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`,
        }),
      }),
      delete: () => ({
        eq: async (col, val) => rest(`${name}?${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`, { method: 'DELETE' }),
      }),
    };
  }

  const auth = {
    getSession: async () => getValidSession(),
    signOut: async () => { clearSession(); return { error: null }; },
    signUp: async ({ email, password, options }) => {
      const data = await authRest('signup', { email, password, data: options?.data || {} });
      const session = { user: data.user, access_token: data.session?.access_token, refresh_token: data.session?.refresh_token, expires_at: data.session?.expires_at };
      if (session.access_token) setSession(session);
      return { data: { user: data.user, session: data.session }, error: null };
    },
    signInWithPassword: async ({ email, password }) => {
      const data = await authRest('token?grant_type=password', { email, password });
      const session = { user: data.user, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
      setSession(session);
      return { data: { user: data.user, session }, error: null };
    },
  };

  const supabase = {
    auth,
    from: table,
  };

  window.supabase = supabase;
  window.SphereDB = window.SphereDB || {};
  window.SphereDB.auth = auth;
})();
