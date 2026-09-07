/* Trade Sphere Marketplace — affiliate page interactions */
(function () {
  const actionBtn = document.getElementById('affiliate-action');
  const status = document.getElementById('affiliate-status');
  if (!actionBtn || !status) return;

  function domReady() {
    refreshAffiliateStatus();
  }

  async function refreshAffiliateStatus() {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const user = session?.user;
      if (!user) {
        status.textContent = 'Sign in to generate your referral link.';
        actionBtn.textContent = 'Get my referral link';
        actionBtn.onclick = (e) => {
          e.preventDefault();
          const signin = document.getElementById('open-signin');
          if (signin) signin.click();
        };
        return;
      }
      const link = await getMyReferralLink();
      if (!link) {
        status.textContent = 'Could not load link yet. Try signing out and back in.';
        actionBtn.textContent = 'Get my referral link';
        actionBtn.onclick = null;
        return;
      }
      status.textContent = 'Your link: ' + link;
      actionBtn.textContent = 'Copy link';
      actionBtn.onclick = async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(link);
          status.textContent = 'Copied: ' + link;
        } catch {
          status.textContent = 'Your link: ' + link + ' (copy manually — clipboard access was blocked)';
        }
      };
    } catch (err) {
      console.error('affiliate refresh error', err);
      status.textContent = 'Something went wrong loading affiliate data.';
      actionBtn.textContent = 'Retry';
      actionBtn.onclick = (e) => { e.preventDefault(); refreshAffiliateStatus(); };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', domReady);
  } else {
    domReady();
  }
})();
