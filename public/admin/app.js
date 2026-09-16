(function () {
  async function api(path, options) {
    const res = await fetch('/api/admin' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 401) {
      location.href = '/admin/login.html?next=' + encodeURIComponent(location.pathname);
      throw new Error('not authenticated');
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Request failed');
    }
    return res.status === 204 ? null : res.json();
  }

  let employers = [];

  function employerOptions(selectedId) {
    return employers
      .map((e) => `<option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${e.name}${e.is_direct_consumer ? '' : ''}</option>`)
      .join('');
  }

  async function loadMe() {
    try {
      const me = await api('/me');
      document.getElementById('staffName').innerHTML = `Signed in as ${me.name} <a href="#" id="logoutLink">Log out</a>`;
      document.getElementById('logoutLink').addEventListener('click', async (e) => {
        e.preventDefault();
        await api('/logout', { method: 'POST' });
        location.href = '/admin/login.html';
      });
    } catch {
      /* redirected already */
    }
  }

  function signupCodeCell(e) {
    if (e.is_direct_consumer) return '—';
    if (!e.signup_code) {
      return `<button class="btn secondary small enable-signup-btn" data-id="${e.id}">Enable</button>`;
    }
    const link = `${location.origin}/join.html?code=${e.signup_code}`;
    return `
      <div style="font-size:0.82rem;">
        <code>${e.signup_code}</code>
        <div style="display:flex; gap:6px; margin-top:4px;">
          <button class="btn secondary small copy-signup-link-btn" data-link="${link}">Copy link</button>
          <button class="btn secondary small disable-signup-btn" data-id="${e.id}">Turn off</button>
        </div>
      </div>`;
  }

  async function loadEmployers() {
    employers = await api('/employers');
    document.getElementById('inviteEmployerSelect').innerHTML = employerOptions();

    document.getElementById('employersBody').innerHTML = employers
      .map(
        (e) => `<tr>
          <td>${e.name}</td>
          <td>${e.is_direct_consumer ? '<span class="badge direct">Direct consumers</span>' : '<span class="badge">Employer group</span>'}</td>
          <td>${e.member_count}</td>
          <td><a href="/employer/?employer=${e.id}" target="_blank">Open dashboard →</a></td>
          <td>${signupCodeCell(e)}</td>
        </tr>`
      )
      .join('');

    document.querySelectorAll('.enable-signup-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api(`/employers/${btn.dataset.id}/signup-code`, { method: 'POST' });
          await loadEmployers();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });

    document.querySelectorAll('.disable-signup-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Turn off self-serve signup for this employer? The current link will stop working.')) return;
        btn.disabled = true;
        try {
          await api(`/employers/${btn.dataset.id}/signup-code`, { method: 'DELETE' });
          await loadEmployers();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });

    document.querySelectorAll('.copy-signup-link-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.link);
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => (btn.textContent = original), 1500);
        } catch {
          prompt('Copy this link:', btn.dataset.link);
        }
      });
    });
  }

  async function loadMembers(q) {
    const rows = await api('/members' + (q ? '?q=' + encodeURIComponent(q) : ''));
    document.getElementById('membersBody').innerHTML = rows
      .map((m) => {
        const contact = [m.email, m.phone].filter(Boolean).join(' · ') || '—';
        return `<tr data-id="${m.id}">
          <td>${m.name}</td>
          <td style="font-size:0.82rem;">${contact}</td>
          <td>
            <select class="inline-select employer-select" data-id="${m.id}">${employerOptions(m.employer_id)}</select>
          </td>
          <td><span class="badge ${m.status !== 'active' ? 'direct' : ''}">${m.status}</span></td>
          <td><button class="btn secondary small resend-btn" data-id="${m.id}">Resend link</button></td>
        </tr>`;
      })
      .join('');

    document.querySelectorAll('.employer-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await api(`/members/${sel.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ employer_id: sel.value }) });
          await loadEmployers();
        } catch (err) {
          alert(err.message);
        }
      });
    });

    document.querySelectorAll('.resend-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
          await api(`/members/${btn.dataset.id}/resend`, { method: 'POST' });
          btn.textContent = 'Sent!';
        } catch (err) {
          btn.textContent = 'Failed';
          alert(err.message);
        } finally {
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Resend link';
          }, 2000);
        }
      });
    });
  }

  async function loadEmployerRequests() {
    const rows = await api('/employer-requests?status=new');
    const badge = document.getElementById('requestsBadge');
    if (rows.length) {
      badge.hidden = false;
      badge.textContent = rows.length;
    } else {
      badge.hidden = true;
    }
    document.getElementById('requestsEmpty').style.display = rows.length ? 'none' : 'block';
    document.getElementById('requestsBody').innerHTML = rows
      .map((r) => {
        const contact = [r.member_email, r.member_phone].filter(Boolean).join(' · ') || '—';
        return `<tr data-id="${r.id}">
          <td>${r.member_name}<div style="font-size:0.78rem; color:var(--text-muted);">${contact}</div></td>
          <td><strong>${r.requested_name}</strong></td>
          <td>${r.member_current_employer_name || '—'}</td>
          <td style="font-size:0.82rem;">${r.created_at}</td>
          <td><select class="inline-select assign-select" data-id="${r.id}"><option value="">Choose group…</option>${employerOptions()}</select></td>
          <td><button class="btn secondary small dismiss-btn" data-id="${r.id}">Dismiss</button></td>
        </tr>`;
      })
      .join('');

    document.querySelectorAll('.assign-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        if (!sel.value) return;
        try {
          await api(`/employer-requests/${sel.dataset.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ action: 'assign', employer_id: sel.value }),
          });
          await Promise.all([loadEmployerRequests(), loadMembers(), loadEmployers()]);
        } catch (err) {
          alert(err.message);
        }
      });
    });

    document.querySelectorAll('.dismiss-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api(`/employer-requests/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'dismiss' }) });
          await loadEmployerRequests();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  }

  async function loadStaff() {
    const rows = await api('/staff');
    document.getElementById('staffBody').innerHTML = rows
      .map((s) => `<tr><td>${s.name}</td><td>${s.email}</td><td>${s.created_at}</td></tr>`)
      .join('');
  }

  // ---- Tabs ----
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.wrap > section').forEach((s) => (s.hidden = true));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).hidden = false;
    });
  });

  // ---- Invite member ----
  document.getElementById('inviteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const statusEl = document.getElementById('inviteStatus');
    const linkBox = document.getElementById('inviteLinkBox');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    statusEl.className = 'status-msg';
    statusEl.textContent = 'Creating…';
    linkBox.hidden = true;
    try {
      const payload = {
        name: fd.get('name'),
        employer_id: fd.get('employer_id') || null,
        email: fd.get('email') || null,
        phone: fd.get('phone') || null,
      };
      const result = await api('/members', { method: 'POST', body: JSON.stringify(payload) });
      statusEl.className = 'status-msg ok';
      const sent = [];
      if (result.notifications?.email) sent.push(result.notifications.email.sent ? 'email sent' : 'email simulated (no SENDGRID_API_KEY)');
      if (result.notifications?.sms) sent.push(result.notifications.sms.sent ? 'text sent' : 'text simulated (no Twilio credentials)');
      statusEl.textContent = `Member created — ${sent.join(', ') || 'no email/phone on file to notify'}.`;
      linkBox.hidden = false;
      linkBox.textContent = result.link;
      e.target.reset();
      await Promise.all([loadEmployers(), loadMembers()]);
    } catch (err) {
      statusEl.className = 'status-msg err';
      statusEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('memberSearch').addEventListener('input', (e) => {
    clearTimeout(window._searchDebounce);
    window._searchDebounce = setTimeout(() => loadMembers(e.target.value.trim()), 250);
  });

  // ---- Employer groups ----
  document.getElementById('employerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const statusEl = document.getElementById('employerStatus');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await api('/employers', {
        method: 'POST',
        body: JSON.stringify({ name: fd.get('name'), glp_benefit_note: fd.get('glp_benefit_note') || null }),
      });
      statusEl.className = 'status-msg ok';
      statusEl.textContent = 'Group created.';
      e.target.reset();
      await loadEmployers();
    } catch (err) {
      statusEl.className = 'status-msg err';
      statusEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ---- Staff ----
  document.getElementById('staffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const statusEl = document.getElementById('staffStatus');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await api('/staff', {
        method: 'POST',
        body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') }),
      });
      statusEl.className = 'status-msg ok';
      statusEl.textContent = 'Staff account created — share the temporary password with them directly.';
      e.target.reset();
      await loadStaff();
    } catch (err) {
      statusEl.className = 'status-msg err';
      statusEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  (async function init() {
    await loadMe();
    await loadEmployers();
    await Promise.all([loadMembers(), loadStaff(), loadEmployerRequests()]);
  })();
})();
