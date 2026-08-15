/*
  Sphere Marketplace — admin authentication.

  Uses Supabase Auth directly (no SDK bundle needed — just its REST API).
  Replaces the old "password string in JS" demo gate with a real login:
  the session is a signed JWT issued by Supabase, and every admin-only
  request (reading full affiliate data, triggering payouts) sends that JWT
  so Postgres Row Level Security can verify the caller is actually in the
  admin_users table — not just someone who guessed a string.

  Setup: create each admin's account once via Supabase Auth (dashboard →
  Authentication → Users → Add user, or have them use a sign-up flow you
  build), then add their user id to admin_users — see backend/README.md.
*/

const SphereAuth = (() => {
  const SESSION_KEY = 'sphere_admin_session';

  function unconfigured() {
    return SUPABASE_URL.includes('YOUR-PROJECT-REF');
  }

  async function signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error_description || data.msg || 'Sign-in failed' };
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user,
    }));
    return { ok: true, session: data };
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Confirms the current session's user is actually in admin_users
  // (RLS-enforced — this call only returns a row if the policy allows it).
  async function verifyIsAdmin() {
    const session = getSession();
    if (!session) return false;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${session.user.id}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return rows.length > 0;
  }

  return { signIn, signOut, getSession, verifyIsAdmin, unconfigured };
})();
