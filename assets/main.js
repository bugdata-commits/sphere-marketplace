/*
  Trade Sphere Marketplace — site interactions (nav, modals, search, reveal animations).
  Kept as an external file (not inline) so the Content-Security-Policy can require
  scripts to come only from this origin / the Supabase CDN — no 'unsafe-inline'.
*/
(function () {
  const signupModal = document.getElementById('signup-modal');
  const openTriggers = document.querySelectorAll('#open-signup,#open-signup-mobile,.open-signup');
  const modalClose = document.getElementById('modal-close');
  const modalDone = document.getElementById('modal-done');
  const formView = document.getElementById('modal-form-view');
  const successView = document.getElementById('modal-success-view');
  const signupForm = document.getElementById('signup-form');

  const signinModal = document.getElementById('signin-modal');
  const openSigninTriggers = document.querySelectorAll('#open-signin,#open-signin-mobile,.open-signin');
  const signinClose = document.getElementById('signin-modal-close');
  const signinForm = document.getElementById('signin-form');

  let lastFocusedEl = null;

  function getFocusable(container) {
    return Array.from(
      container.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.offsetParent !== null);
  }

  function openModal(modal) {
    lastFocusedEl = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    const focusable = getFocusable(modal);
    (focusable[0] || modal).focus();
    document.addEventListener('keydown', trapFocus);
  }

  function closeModal(modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', trapFocus);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
  }

  function trapFocus(e) {
    const openModalEl = document.querySelector('.modal-overlay.open');
    if (!openModalEl) return;
    if (e.key === 'Escape') {
      closeModal(openModalEl);
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = getFocusable(openModalEl);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (signupModal && signupForm) {
    openTriggers.forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        formView.style.display = 'block';
        successView.style.display = 'none';
        signupForm.reset();
        openModal(signupModal);
      })
    );
    modalClose.addEventListener('click', () => closeModal(signupModal));
    modalDone.addEventListener('click', () => closeModal(signupModal));
    signupModal.addEventListener('click', (e) => {
      if (e.target === signupModal) closeModal(signupModal);
    });
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('su-name').value.trim();
      const email = document.getElementById('su-email').value.trim();
      const password = document.getElementById('su-password').value;
      const submitBtn = signupForm.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account…';
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, role: 'seller' } },
        });
        if (error) {
          showToast(error.message || 'Something went wrong — please try again.');
          console.error(error);
          return;
        }
        try { await SphereDB.recordSignup(name, email); } catch (e) { console.warn('recordSignup failed', e); }
        formView.style.display = 'none';
        successView.style.display = 'block';
        document.getElementById('modal-success-msg').textContent = 'Your seller account has been created.';
        const doneBtn = document.getElementById('modal-done');
        if (doneBtn) doneBtn.focus();
      } catch (err) {
        const msg = (err && err.message) ? err.message : 'Something went wrong — please try again.';
        showToast(msg);
        console.error(err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create seller account';
      }
    });
  }

  if (signinModal && signinForm) {
    openSigninTriggers.forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        signinForm.reset();
        document.getElementById('signin-feedback').textContent = '';
        openModal(signinModal);
      })
    );
    signinClose.addEventListener('click', () => closeModal(signinModal));
    signinModal.addEventListener('click', (e) => {
      if (e.target === signinModal) closeModal(signinModal);
    });
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('si-email').value.trim();
      const password = document.getElementById('si-password').value;
      const feedback = document.getElementById('signin-feedback');
      const submitBtn = signinForm.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          feedback.textContent = error.message;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign in';
          return;
        }
        window.location.href = 'seller-dashboard.html';
      } catch (err) {
        feedback.textContent = 'Something went wrong.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
        console.error(err);
      }
    });
  }

  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open);
    });
    mobileMenu.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', false);
      })
    );
  }

  const searchToggle = document.getElementById('search-toggle');
  const mobileSearch = document.getElementById('mobile-search');
  if (searchToggle && mobileSearch) {
    searchToggle.addEventListener('click', () => {
      const open = mobileSearch.classList.toggle('open');
      searchToggle.setAttribute('aria-expanded', open);
      if (open) mobileSearch.querySelector('input').focus();
    });
  }

  const heroInput = document.getElementById('hero-search-input');
  document.querySelectorAll('[data-query]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (!heroInput) return;
      heroInput.value = btn.dataset.query;
      heroInput.focus();
    })
  );

  // All search forms: prevent the native GET submit (no search backend yet)
  // and show a toast instead. Handled here — not via inline onsubmit — so
  // the CSP can disallow inline script attributes.
  document.querySelectorAll('form[role=search]').forEach((form) =>
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      if (input && input.value.trim()) showToast('Searching the Sphere for “' + input.value.trim() + '”…');
    })
  );

  const revealEls = document.querySelectorAll('[data-reveal]');
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      }),
    { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
  );
  revealEls.forEach((el) => io.observe(el));

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
  }

  if (window.SphereDB) SphereDB.captureReferralFromURL();
})();
