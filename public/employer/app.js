(function () {
  const params = new URLSearchParams(location.search);
  const employerId = params.get('employer') || 'demo-employer';

  let rosterData = [];
  let sortKey = 'engagement_score';
  let sortDir = 1; // ascending — lowest engagement (most at-risk) surfaces first

  function fmtPct(v) {
    if (v == null) return '—';
    return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
  }
  function fmtPts(v) {
    if (v == null) return '—';
    return `${v > 0 ? '+' : ''}${v.toFixed(1)} pts`;
  }
  function timeAgo(iso) {
    if (!iso) return 'no activity';
    const diffMs = Date.now() - new Date(iso + 'Z').getTime();
    const days = Math.floor(diffMs / (24 * 3600 * 1000));
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  function barChart(rows) {
    if (!rows.length) return '<p style="color:var(--text-muted)">No engagement data yet.</p>';
    const w = 900, h = 220, pad = 34;
    const max = Math.max(...rows.map((r) => r.engagements), 1);
    const barW = (w - pad * 2) / rows.length - 8;
    const bars = rows
      .map((r, i) => {
        const x = pad + i * ((w - pad * 2) / rows.length);
        const barH = (r.engagements / max) * (h - pad * 2);
        const y = h - pad - barH;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="var(--primary)" />
                <text x="${(x + barW / 2).toFixed(1)}" y="${h - 12}" font-size="10" fill="var(--text-muted)" text-anchor="middle">${r.yweek.split('-')[1]}</text>`;
      })
      .join('');
    return `<svg viewBox="0 0 ${w} ${h}">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--border)" stroke-width="1"/>
      ${bars}
      <text x="${pad}" y="16" font-size="11" fill="var(--text-muted)">${max} engagements / wk max</text>
    </svg>`;
  }

  function groupLineChart(rows, key, color) {
    if (!rows.length || rows.length < 2) return '<p style="color:var(--text-muted)">Not enough weekly readings yet.</p>';
    const w = 900, h = 200, pad = 34;
    const ys = rows.map((r) => r[key]);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanY = maxY - minY || 1;
    const x = (i) => pad + (i / (rows.length - 1)) * (w - pad * 2);
    const y = (v) => h - pad - ((v - minY) / spanY) * (h - pad * 2);
    const path = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(r[key]).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--border)" stroke-width="1"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <text x="${pad}" y="16" font-size="11" fill="var(--text-muted)">${maxY.toFixed(1)}</text>
      <text x="${pad}" y="${h - pad - 4}" font-size="11" fill="var(--text-muted)">${minY.toFixed(1)}</text>
      <text x="${w - pad}" y="${h - 10}" font-size="11" fill="var(--text-muted)" text-anchor="end">wk ${rows[rows.length - 1].yweek.split('-')[1]}</text>
    </svg>`;
  }

  function lineChart(points, color) {
    if (points.length < 2) return '<p style="color:var(--text-muted)">Not enough readings yet.</p>';
    const w = 560, h = 200, pad = 32;
    const ys = points.map((p) => p.v);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanY = maxY - minY || 1;
    const x = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = (v) => h - pad - ((v - minY) / spanY) * (h - pad * 2);
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--border)" stroke-width="1"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <text x="${pad}" y="${h - 10}" font-size="11" fill="var(--text-muted)">${points[0].date}</text>
      <text x="${w - pad}" y="${h - 10}" font-size="11" fill="var(--text-muted)" text-anchor="end">${points[points.length - 1].date}</text>
    </svg>`;
  }

  function renderRoster() {
    const rows = [...rosterData].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'last_engagement') { av = a.last_engagement?.created_at || ''; bv = b.last_engagement?.created_at || ''; }
      if (sortKey === 'engagement_score') { av = a.engagement.score; bv = b.engagement.score; }
      if (av == null) av = -Infinity;
      if (bv == null) bv = -Infinity;
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });

    document.getElementById('rosterBody').innerHTML = rows
      .map((r) => {
        const wChangeCls = r.weight_change_pct == null ? '' : r.weight_change_pct < 0 ? 'down' : 'up';
        const fChangeCls = r.body_fat_change == null ? '' : r.body_fat_change < 0 ? 'down' : 'up';
        const bmiChangeCls = r.bmi_change == null ? '' : r.bmi_change < 0 ? 'down' : 'up';
        return `<tr class="member-row" data-id="${r.id}">
          <td>${r.name}</td>
          <td><span class="badge ${r.status !== 'active' ? 'inactive' : ''}">${r.status}</span></td>
          <td><span class="attention-badge ${r.engagement.color}">${r.engagement.score} · ${r.engagement.band}</span></td>
          <td class="chg ${wChangeCls}">${fmtPct(r.weight_change_pct)}</td>
          <td class="chg ${fChangeCls}">${fmtPts(r.body_fat_change)}</td>
          <td>${r.bmi_current != null ? r.bmi_current : '—'}${r.bmi_change != null ? ` <span class="chg ${bmiChangeCls}">(${r.bmi_change > 0 ? '+' : ''}${r.bmi_change})</span>` : ''}</td>
          <td>${r.engagement_count}</td>
          <td>${timeAgo(r.last_engagement?.created_at)}</td>
        </tr>`;
      })
      .join('');

    document.querySelectorAll('.member-row').forEach((tr) => {
      tr.addEventListener('click', () => openDrilldown(tr.dataset.id));
    });
  }

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      sortDir = key === sortKey ? -sortDir : -1;
      sortKey = key;
      renderRoster();
    });
  });

  async function openDrilldown(memberId) {
    const res = await fetch(`/api/employer/${employerId}/members/${memberId}`);
    const data = await res.json();
    const weightPts = data.vitals_history.filter((v) => v.weight_lbs != null).map((v) => ({ date: v.date.slice(5), v: v.weight_lbs }));
    const bmiPts = data.vitals_history.filter((v) => v.bmi != null).map((v) => ({ date: v.date.slice(5), v: v.bmi }));
    const profileBits = [
      data.member.gender,
      data.member.age ? `${data.member.age}y` : null,
      data.member.height_in ? `${Math.floor(data.member.height_in / 12)}'${Math.round(data.member.height_in % 12)}"` : null,
      data.member.activity_level ? data.member.activity_level.replace('_', ' ') : null,
    ].filter(Boolean).join(' · ');

    const grid = data.food_logging_grid || [];
    const gridCells = grid.map((d) => `<div class="cell ${d.logged ? 'logged' : ''}" title="${d.date}"></div>`).join('');
    const loggedDays = grid.filter((d) => d.logged).length;

    document.getElementById('modalContent').innerHTML = `
      <button class="modal-close" id="modalClose">✕</button>
      <h2 style="margin-bottom:2px;">${data.member.name}</h2>
      <p style="color:var(--text-muted); margin-top:0; font-size:0.85rem;">Started ${data.member.program_start_date} at ${data.member.starting_weight_lbs || '—'} lbs${profileBits ? ' · ' + profileBits : ''}</p>
      <div style="margin:10px 0 14px;">
        <span class="attention-badge ${data.engagement.color}">${data.engagement.score}/100 · ${data.engagement.band}</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:14px 0;">
        <div><p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 4px;">Weight</p>${lineChart(weightPts, 'var(--primary)')}</div>
        <div><p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 4px;">BMI</p>${lineChart(bmiPts, 'var(--accent)')}</div>
      </div>
      <p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 4px;">Food logging, last ${grid.length} days — ${loggedDays} of ${grid.length}</p>
      <div class="food-grid">${gridCells}</div>
      <h2 style="font-size:1rem; margin-top:18px;">Engagement timeline</h2>
      <div>${
        data.timeline.length
          ? data.timeline.map((t) => `<div class="timeline-item"><strong>${t.type}</strong> — ${t.summary || ''}<div class="meta">${t.created_at}</div></div>`).join('')
          : '<p style="color:var(--text-muted)">No engagements logged yet.</p>'
      }</div>
    `;
    document.getElementById('modalBackdrop').hidden = false;
    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('modalBackdrop').hidden = true;
    });
  }

  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') e.target.hidden = true;
  });

  async function load() {
    const res = await fetch(`/api/employer/${employerId}/dashboard`);
    if (res.status === 401) {
      location.href = '/admin/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      return;
    }
    if (!res.ok) {
      document.querySelector('.wrap').innerHTML = '<p>Employer not found. Try appending <code>?employer=&lt;id&gt;</code> to the URL.</p>';
      return;
    }
    const data = await res.json();
    document.getElementById('employerName').textContent = `${data.employer.name} · Engagement Console`;
    document.getElementById('kpiMembers').textContent = data.summary.member_count;
    document.getElementById('kpiParticipation').textContent = `${Math.round(data.summary.participation_rate * 100)}%`;
    document.getElementById('kpiParticipationSub').textContent = `${data.summary.active_last_7_days} of ${data.summary.member_count} participants`;
    document.getElementById('kpiWeight').textContent = fmtPct(data.summary.avg_weight_change_pct);
    document.getElementById('kpiBmi').textContent = data.summary.avg_current_bmi != null ? data.summary.avg_current_bmi.toFixed(1) : '—';
    document.getElementById('kpiBmiSub').textContent =
      data.summary.avg_bmi_change != null
        ? `${data.summary.avg_bmi_change > 0 ? '+' : ''}${data.summary.avg_bmi_change.toFixed(1)} vs. start`
        : 'vs. program start';
    document.getElementById('kpiWorkouts').textContent = data.summary.total_workouts_logged;
    document.getElementById('trendChart').innerHTML = barChart(data.weekly_trend);
    document.getElementById('bmiTrendChart').innerHTML = groupLineChart(data.weekly_bmi_trend, 'avg_bmi', 'var(--accent)');

    const engagementEl = document.getElementById('kpiEngagement');
    engagementEl.textContent = data.summary.avg_engagement_score != null ? Math.round(data.summary.avg_engagement_score) : '—';
    document.getElementById('kpiEngagementSub').textContent =
      data.summary.avg_food_logging_pct != null ? `Food logging avg. ${Math.round(data.summary.avg_food_logging_pct)}% of days` : '0-100, food logging + weigh-ins + recency';

    const attn = data.summary.needs_attention;
    const attentionEl = document.getElementById('kpiAttention');
    attentionEl.textContent = attn ? `${attn.count}/${attn.total}` : '—';
    attentionEl.classList.toggle('attention-red', !!attn && attn.count > 0);
    document.getElementById('kpiAttentionSub').textContent = attn ? `${attn.red} red · ${attn.yellow} yellow` : '';

    const noticeEl = document.getElementById('whatINotice');
    noticeEl.innerHTML = data.insights?.what_i_notice?.length
      ? data.insights.what_i_notice.map((n) => `<li>${n}</li>`).join('')
      : '<li style="color:var(--text-muted)">Nothing notable this period.</li>';

    const actionsEl = document.getElementById('nextBestActions');
    actionsEl.innerHTML = data.insights?.next_best_actions?.length
      ? data.insights.next_best_actions
          .map((a) => `<div class="next-action-item"><strong>${a.name}</strong> — <span class="reason">${a.reason}.</span> ${a.action}</div>`)
          .join('')
      : '<p style="color:var(--text-muted); font-size:0.92rem;">Everyone is on track — nothing needs a nudge right now.</p>';

    rosterData = data.roster;
    renderRoster();
  }

  load();
})();
