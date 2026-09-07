/* Trade Sphere Marketplace — seller dashboard */
(function () {
  let me = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  async function init() {
    try {
      const { data } = await (typeof supabase !== 'undefined' ? supabase.auth.getSession() : Promise.resolve({ data: { session: null } }));
      me = data?.session?.user;
    } catch (e) {
      console.error('Auth session error', e);
      me = null;
    }

    if (!me) {
      document.querySelector('#auth-gate').style.display = 'block';
      document.querySelector('#dash-content').style.display = 'none';
      return;
    }

    document.querySelector('#auth-gate').style.display = 'none';
    document.querySelector('#dash-content').style.display = 'block';
    document.querySelector('#dash-user').textContent = me.email;

    await loadCategoryOptions();
    await loadMyListings();

    document.querySelector('#signout-link').addEventListener('click', async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });

    document.querySelector('#listing-form').addEventListener('submit', createListing);

    // Event delegation instead of inline onclick — keeps the CSP script-src
    // free of 'unsafe-inline' and avoids re-wiring handlers on every re-render.
    document.querySelector('#my-listings-body').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const { action, id, status } = btn.dataset;
      if (action === 'toggle-sold') toggleSold(id, status);
      if (action === 'delete-listing') deleteListing(id);
    });
  }

  async function loadCategoryOptions() {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order');
    if (error) return console.error(error);
    const select = document.querySelector("select[name='category_id']");
    select.innerHTML = data.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  async function loadMyListings() {
    const body = document.querySelector('#my-listings-body');
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', me.id)
      .order('created_at', { ascending: false });

    if (error) {
      body.innerHTML = `<tr><td colspan="4">Couldn't load your listings.</td></tr>`;
      return console.error(error);
    }

    if (!data.length) {
      body.innerHTML = `<tr><td colspan="4" class="empty-state">No listings yet — publish your first one above.</td></tr>`;
      return;
    }

    body.innerHTML = data
      .map(
        (l) => `
      <tr>
        <td>${escapeHtml(l.title)}</td>
        <td>${l.price ? '$' + Number(l.price).toLocaleString() : '—'}</td>
        <td><span class="status-pill${l.status === 'sold' ? ' sold' : ''}">${escapeHtml(l.status)}</span></td>
        <td class="row-actions">
          <button type="button" data-action="toggle-sold" data-id="${l.id}" data-status="${l.status}">${l.status === 'sold' ? 'Mark active' : 'Mark sold'}</button>
          <button type="button" data-action="delete-listing" data-id="${l.id}">Delete</button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  async function createListing(e) {
    e.preventDefault();
    const form = e.target;
    const feedback = document.querySelector('#listing-feedback');
    const submitBtn = form.querySelector('button[type=submit]');

    const payload = {
      seller_id: me.id,
      title: form.title.value.trim(),
      category_id: form.category_id.value,
      price: form.price.value || null,
      location: form.location.value.trim(),
      image_url: form.image_url.value.trim(),
      description: form.description.value.trim(),
      status: 'active',
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing…';
    const { error } = await supabase.from('listings').insert(payload);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish listing';

    if (error) {
      feedback.textContent = error.message;
      return;
    }
    feedback.textContent = '';
    form.reset();
    await loadMyListings();
  }

  async function toggleSold(id, currentStatus) {
    const newStatus = currentStatus === 'sold' ? 'active' : 'sold';
    await supabase.from('listings').update({ status: newStatus }).eq('id', id);
    await loadMyListings();
  }

  async function deleteListing(id) {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    await supabase.from('listings').delete().eq('id', id);
    await loadMyListings();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
