/* Trade Sphere Marketplace — affiliate page interactions */
(function () {
  const actionBtn = document.getElementById('affiliate-action');
  const status = document.getElementById('affiliate-status');
  if (!actionBtn || !status) return;

  async function refreshAffiliateStatus() {
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
    status.textContent = link ? `Your link: ${link}` : 'Could not load link yet.';
    actionBtn.textContent = 'Copy link';
    actionBtn.onclick = async (e) => {
      e.preventDefault();
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link);
        status.textContent = 'Copied: ' + link;
      } catch {
        status.textContent = 'Your link: ' + link + ' (copy manually — clipboard access was blocked)';
      }
    };
  }

  document.addEventListener('DOMContentLoaded', refreshAffiliateStatus);
})();
