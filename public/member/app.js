(function () {
  const params = new URLSearchParams(location.search);
  const demoId = params.get('demo');
  if (demoId) localStorage.setItem('medfit_member_id', demoId);

  const memberId = localStorage.getItem('medfit_member_id');
  if (!memberId) {
    location.href = 'welcome.html' + (demoId ? '' : '');
    return;
  }

  const $ = (sel) => document.querySelector(sel);
  const screens = ['home', 'coach', 'log', 'progress'];

  function goTo(name) {
    screens.forEach((s) => {
      document.getElementById('screen-' + s).hidden = s !== name;
    });
    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.nav === name);
    });
    document.querySelector('.chat-input-row')?.remove();
    if (name === 'coach') mountChatInput();
    if (name === 'progress') renderCharts();
    if (name === 'log') loadLogHistory();
  }
  window.goTo = goTo;

  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.addEventListener('click', () => goTo(b.dataset.nav));
  });

  // ---------- HOME ----------
  async function loadSummary() {
    const res = await fetch(`/api/members/${memberId}/summary`);
    if (!res.ok) return;
    const data = await res.json();

    if (!data.member.onboarding_completed) {
      location.href = 'onboarding.html';
      return;
    }

    $('#greeting').textContent = `Hi ${data.member.name.split(' ')[0]}`;
    $('#weekPill').textContent = `Week ${data.member.week_number} · Liver-Support Reset`;

    if (data.latest?.weight_lbs) {
      $('#statWeight').textContent = `${data.latest.weight_lbs} lbs`;
    }
    if (data.latest?.weight_lbs && data.starting.weight_lbs) {
      const diff = data.latest.weight_lbs - data.starting.weight_lbs;
      const el = $('#statWeightChange');
      el.textContent = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} lbs`;
      el.classList.add(diff < 0 ? 'negative' : 'positive');
    }
    if (data.latest?.body_fat_pct) {
      $('#statBodyFat').textContent = `${data.latest.body_fat_pct}%`;
    }
    if (data.bmi?.current) {
      $('#statBmi').textContent = data.bmi.current;
      $('#statBmiCategory').textContent = data.bmi.category || '';
    } else {
      $('#statBmi').textContent = '—';
    }
    $('#statWorkouts').textContent = data.workouts_this_week;
  }

  async function loadDailyMessage() {
    const res = await fetch(`/api/members/${memberId}/daily-message`);
    if (!res.ok) return;
    const data = await res.json();
    const card = $('#todayCard');
    if (!data.message) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    $('#todayCardTitle').textContent = `Day ${data.day} of your Reset`;
    $('#todayCardMessage').textContent = data.message;
    const btn = $('#todayCardAction');
    if (data.action?.type === 'log_weight') {
      btn.style.display = 'block';
      btn.textContent = 'Log today\'s weight →';
      btn.onclick = () => {
        goTo('log');
        document.querySelector('[data-logtab="vitals"]').click();
      };
    } else if (data.action?.type === 'ask_coach') {
      btn.style.display = 'block';
      btn.textContent = 'Ask your coach →';
      btn.onclick = () => {
        goTo('coach');
        sendChat(data.action.prompt);
      };
    } else {
      btn.style.display = 'none';
    }
  }

  async function loadResources() {
    const res = await fetch('/api/coach/resources');
    if (!res.ok) return;
    const lib = await res.json();
    const items = [...lib.nutrition.slice(0, 2), ...lib.workouts.slice(0, 2)];
    $('#resourceList').innerHTML = items
      .map((r) => `<div class="log-item"><a href="${r.url}" target="_blank" rel="noopener">${r.title}</a><span class="meta">${r.source}</span></div>`)
      .join('');
  }

  document.querySelectorAll('[data-ask]').forEach((btn) => {
    btn.addEventListener('click', () => {
      goTo('coach');
      sendChat(btn.dataset.ask);
    });
  });

  // ---------- COACH ----------
  function mountChatInput() {
    const row = document.createElement('div');
    row.className = 'chat-input-row';
    row.innerHTML = `<input type="text" id="chatInput" placeholder="Ask about a recipe, a menu, a grocery list…">
      <button id="chatSend">Send</button>`;
    document.querySelector('.app-shell').appendChild(row);
    $('#chatSend').addEventListener('click', () => {
      const v = $('#chatInput').value.trim();
      if (v) sendChat(v);
      $('#chatInput').value = '';
    });
    $('#chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#chatSend').click();
    });
  }

  function appendMsg(role, text) {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.textContent = text;
    $('#chatLog').appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  async function loadChatHistory() {
    const res = await fetch(`/api/coach/history/${memberId}`);
    if (!res.ok) return;
    const rows = await res.json();
    $('#chatLog').innerHTML = '';
    if (rows.length === 0) {
      appendMsg('assistant', "Hi! I'm your MedFit coach. Ask me for this week's grocery list, a shake or dinner recipe, or how to navigate a restaurant menu.");
    }
    rows.forEach((r) => appendMsg(r.role, r.content));
  }

  async function sendChat(message) {
    appendMsg('user', message);
    const typing = document.createElement('div');
    typing.className = 'msg assistant';
    typing.textContent = '…';
    $('#chatLog').appendChild(typing);
    const res = await fetch('/api/coach/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, message }),
    });
    const data = await res.json();
    typing.remove();
    appendMsg('assistant', data.reply);
    if (!data.live) {
      const note = document.createElement('div');
      note.className = 'badge-live';
      note.textContent = 'Demo mode — connect ANTHROPIC_API_KEY for live AI responses';
      $('#chatLog').appendChild(note);
    }
  }

  // ---------- LOG ----------
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      ['meal', 'workout', 'vitals'].forEach((t) => {
        document.getElementById('form-' + t).hidden = t !== btn.dataset.logtab;
      });
    });
  });

  function formToObj(form) {
    const obj = { member_id: memberId };
    new FormData(form).forEach((v, k) => {
      if (k === 'photo') return;
      if (v !== '') obj[k] = v;
    });
    return obj;
  }

  $('#form-meal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fileInput = form.querySelector('[name=photo]');
    const obj = formToObj(form);
    if (fileInput.files[0]) obj.photo_note = `Photo attached: ${fileInput.files[0].name}`;
    await fetch('/api/engagement/meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
    form.reset();
    loadLogHistory();
    loadSummary();
  });

  $('#form-workout').addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetch('/api/engagement/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formToObj(e.target)) });
    e.target.reset();
    loadLogHistory();
    loadSummary();
  });

  $('#form-vitals').addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetch('/api/engagement/vitals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formToObj(e.target)) });
    e.target.reset();
    loadLogHistory();
    loadSummary();
  });

  async function loadLogHistory() {
    const [meals, workouts] = await Promise.all([
      fetch(`/api/engagement/meals/${memberId}`).then((r) => r.json()),
      fetch(`/api/engagement/workouts/${memberId}`).then((r) => r.json()),
    ]);
    const combined = [
      ...meals.map((m) => ({ date: m.date, label: `${m.meal_type}: ${m.description}`, meta: m.calories ? `${m.calories} kcal` : '' })),
      ...workouts.map((w) => ({ date: w.date, label: `${w.workout_type}`, meta: `${w.duration_min || '?'} min · ${w.category}` })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);

    $('#logHistory').innerHTML = combined.length
      ? combined.map((i) => `<div class="log-item"><span>${i.label}</span><span class="meta">${i.date} ${i.meta ? '· ' + i.meta : ''}</span></div>`).join('')
      : '<p class="badge-live">Nothing logged yet.</p>';
  }

  // ---------- PROGRESS ----------
  function lineChart(points, { label, color }) {
    if (points.length < 2) return `<p class="badge-live">Log a couple of readings to see your ${label} trend.</p>`;
    const w = 600, h = 220, pad = 34;
    const xs = points.map((_, i) => i);
    const ys = points.map((p) => p.v);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanY = maxY - minY || 1;
    const x = (i) => pad + (i / (xs.length - 1)) * (w - pad * 2);
    const y = (v) => h - pad - ((v - minY) / spanY) * (h - pad * 2);
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" fill="${color}" />`).join('');
    const firstLabel = points[0].date, lastLabel = points[points.length - 1].date;
    return `<svg viewBox="0 0 ${w} ${h}">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--border)" stroke-width="1"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      <text x="${pad}" y="${h - 10}" font-size="11" fill="var(--text-muted)">${firstLabel}</text>
      <text x="${w - pad}" y="${h - 10}" font-size="11" fill="var(--text-muted)" text-anchor="end">${lastLabel}</text>
      <text x="${pad}" y="16" font-size="11" fill="var(--text-muted)">${maxY.toFixed(1)}</text>
      <text x="${pad}" y="${h - pad - 4}" font-size="11" fill="var(--text-muted)">${minY.toFixed(1)}</text>
    </svg>`;
  }

  async function renderCharts() {
    const res = await fetch(`/api/members/${memberId}/summary`);
    const data = await res.json();
    const weightPts = data.vitals_history.filter((v) => v.weight_lbs != null).map((v) => ({ date: v.date.slice(5), v: v.weight_lbs }));
    const fatPts = data.vitals_history.filter((v) => v.body_fat_pct != null).map((v) => ({ date: v.date.slice(5), v: v.body_fat_pct }));
    $('#weightChart').innerHTML = lineChart(weightPts, { label: 'weight', color: 'var(--primary)' });
    $('#fatChart').innerHTML = lineChart(fatPts, { label: 'body fat', color: 'var(--accent)' });
    loadPhotoGallery();
  }

  // ---------- PROGRESS PHOTOS (private — never surfaced to the employer) ----------
  async function loadPhotoGallery() {
    const gallery = $('#photoGallery');
    if (!gallery) return;
    const res = await fetch(`/api/photos/${memberId}`);
    if (!res.ok) return;
    const photos = await res.json();
    if (photos.length === 0) {
      gallery.innerHTML = '<p class="badge-live">No photos yet — add your starting photo from onboarding, or add one now.</p>';
      return;
    }
    gallery.innerHTML = photos
      .slice()
      .reverse()
      .map(
        (p) => `<div class="photo-tile">
          <img src="${p.url}" alt="Progress photo, ${p.photo_type}, ${p.taken_on}" loading="lazy">
          <span class="tag">${p.photo_type === 'baseline' ? 'Start' : p.taken_on}</span>
        </div>`
      )
      .join('');
  }

  const monthlyPhotoInput = document.getElementById('monthlyPhotoInput');
  if (monthlyPhotoInput) {
    monthlyPhotoInput.addEventListener('change', async () => {
      const file = monthlyPhotoInput.files[0];
      if (!file) return;
      const label = monthlyPhotoInput.closest('label');
      const originalText = label.firstChild.textContent;
      label.firstChild.textContent = 'Uploading…';
      const fd = new FormData();
      fd.append('member_id', memberId);
      fd.append('photo_type', 'monthly');
      fd.append('taken_on', new Date().toISOString().slice(0, 10));
      fd.append('photo', file);
      await fetch('/api/photos', { method: 'POST', body: fd });
      monthlyPhotoInput.value = '';
      label.firstChild.textContent = originalText;
      loadPhotoGallery();
    });
  }

  loadSummary();
  loadChatHistory();
  loadResources();
  loadDailyMessage();
})();
