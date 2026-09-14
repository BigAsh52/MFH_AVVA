// PRIVACY BOUNDARY: progress photos (the `progress_photos` table,
// routes/photos.js) are private to the member and must never be queried,
// counted, or referenced from anything in this file. An employer may see
// generic engagement entries (a "photo" type shows up in a member's
// engagement count the same as a meal or workout), never a photo or a link
// to one. If you're adding a new employer-facing field, keep it that way.

const express = require('express');
const db = require('../db');
const { computeBmi } = require('../lib/health');
const { computeEngagement, foodLoggingGrid } = require('../lib/engagement');

const router = express.Router();

function latestVitals(memberId) {
  return db
    .prepare('SELECT * FROM vitals WHERE member_id = ? ORDER BY date DESC LIMIT 1')
    .get(memberId);
}

function weightChangePct(member) {
  const latest = latestVitals(member.id);
  if (!latest?.weight_lbs || !member.starting_weight_lbs) return null;
  return ((latest.weight_lbs - member.starting_weight_lbs) / member.starting_weight_lbs) * 100;
}

function bodyFatChange(member) {
  const latest = latestVitals(member.id);
  if (!latest?.body_fat_pct || member.starting_body_fat_pct == null) return null;
  return latest.body_fat_pct - member.starting_body_fat_pct;
}

function bmiChange(member) {
  if (!member.height_in) return null;
  const latest = latestVitals(member.id);
  const startBmi = computeBmi(member.starting_weight_lbs, member.height_in);
  const currentBmi = computeBmi(latest?.weight_lbs, member.height_in);
  if (startBmi == null || currentBmi == null) return null;
  return { starting: startBmi, current: currentBmi, change: +(currentBmi - startBmi).toFixed(1) };
}

// Programmatically generated coaching-triage insights — computed fresh from
// each dashboard's own data every time, never hardcoded copy. Kept short and
// factual on purpose.
function buildInsights(membersWithEngagement) {
  const total = membersWithEngagement.length;
  const notice = [];
  const actions = [];
  if (total === 0) return { what_i_notice: notice, next_best_actions: actions };

  const noWeighIn = membersWithEngagement.filter((m) => m.engagement.weigh_ins === 0);
  if (noWeighIn.length > 0) {
    notice.push(
      `${noWeighIn.length} of ${total} member${total === 1 ? '' : 's'} ${noWeighIn.length === 1 ? 'has' : 'have'} not logged a weigh-in in the last ${noWeighIn[0].engagement.window_days} days.`
    );
  }

  const highLoggers = membersWithEngagement.filter((m) => m.engagement.food_logging_pct >= 70).length;
  const lowLoggers = membersWithEngagement.filter((m) => m.engagement.food_logging_pct < 40).length;
  if (highLoggers > 0 && lowLoggers > 0) {
    notice.push(
      `Engagement is split: ${highLoggers} member${highLoggers === 1 ? '' : 's'} log${highLoggers === 1 ? 's' : ''} most days, while ${lowLoggers} ${lowLoggers === 1 ? 'has' : 'have'} gaps of a week or more.`
    );
  }

  const needsAttention = membersWithEngagement
    .filter((m) => m.engagement.color === 'red' || m.engagement.color === 'yellow')
    .sort((a, b) => a.engagement.score - b.engagement.score)
    .slice(0, 5);

  needsAttention.forEach((m) => {
    let reason;
    if (m.engagement.days_since_last_engagement == null) {
      reason = 'no engagement logged yet';
    } else if (m.engagement.days_since_last_engagement > 7) {
      reason = `no activity in ${m.engagement.days_since_last_engagement} days`;
    } else {
      reason = `logging is inconsistent (~${m.engagement.food_logging_pct}% of days)`;
    }
    const action =
      m.engagement.color === 'red'
        ? 'Reach out and invite them back to a simple daily check-in.'
        : 'A light nudge or reminder could help before it slips further.';
    actions.push({ member_id: m.id, name: m.name, reason, action });
  });

  return { what_i_notice: notice, next_best_actions: actions };
}

function isoWeekKey(dateStr) {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - firstDay) / 86400000 + firstDay.getUTCDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, '0')}`;
}

router.get('/:employerId/dashboard', (req, res) => {
  const employer = db.prepare('SELECT * FROM employers WHERE id = ?').get(req.params.employerId);
  if (!employer) return res.status(404).json({ error: 'not found' });

  const members = db.prepare('SELECT * FROM members WHERE employer_id = ?').all(employer.id);
  const memberIds = members.map((m) => m.id);
  const placeholders = memberIds.map(() => '?').join(',') || 'NULL';

  const weightChanges = members.map(weightChangePct).filter((v) => v != null);
  const fatChanges = members.map(bodyFatChange).filter((v) => v != null);
  const bmiChanges = members.map(bmiChange).filter((v) => v != null);

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const avgWeightChangePct = avg(weightChanges);
  const avgBodyFatChange = avg(fatChanges);
  const avgCurrentBmi = avg(bmiChanges.map((b) => b.current));
  const avgBmiChange = avg(bmiChanges.map((b) => b.change));

  const activeLast7 = db
    .prepare(
      `SELECT COUNT(DISTINCT member_id) as c FROM engagements
       WHERE member_id IN (${placeholders}) AND created_at >= datetime('now', '-7 days')`
    )
    .get(...memberIds).c;

  const totalWorkouts = db
    .prepare(`SELECT COUNT(*) as c FROM workouts WHERE member_id IN (${placeholders})`)
    .get(...memberIds).c;

  // Weekly engagement volume across the whole group, last 8 weeks.
  const weeklyTrend = db
    .prepare(
      `SELECT strftime('%Y-%W', created_at) as yweek, COUNT(*) as engagements
       FROM engagements
       WHERE member_id IN (${placeholders})
       GROUP BY yweek ORDER BY yweek ASC`
    )
    .all(...memberIds);

  // Weekly average BMI across the group — computed in JS since it depends on
  // each member's fixed height, not just the vitals row.
  const heightByMember = Object.fromEntries(members.map((m) => [m.id, m.height_in]));
  const allVitals = memberIds.length
    ? db
        .prepare(`SELECT member_id, date, weight_lbs FROM vitals WHERE member_id IN (${placeholders}) AND weight_lbs IS NOT NULL`)
        .all(...memberIds)
    : [];
  const bmiByWeek = {};
  allVitals.forEach((v) => {
    const height = heightByMember[v.member_id];
    const bmi = computeBmi(v.weight_lbs, height);
    if (bmi == null) return;
    const key = isoWeekKey(v.date);
    (bmiByWeek[key] = bmiByWeek[key] || []).push(bmi);
  });
  const weeklyBmiTrend = Object.keys(bmiByWeek)
    .sort()
    .map((yweek) => ({ yweek, avg_bmi: +(bmiByWeek[yweek].reduce((a, b) => a + b, 0) / bmiByWeek[yweek].length).toFixed(1) }));

  const roster = members.map((m) => {
    const lastEngagement = db
      .prepare('SELECT created_at, type, summary FROM engagements WHERE member_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(m.id);
    const engagementCount = db.prepare('SELECT COUNT(*) as c FROM engagements WHERE member_id = ?').get(m.id).c;
    const bmi = bmiChange(m);
    const engagement = computeEngagement(m.id, m);
    return {
      id: m.id,
      name: m.name,
      status: m.status,
      program_start_date: m.program_start_date,
      gender: m.gender,
      age: m.age,
      weight_change_pct: weightChangePct(m),
      body_fat_change: bodyFatChange(m),
      bmi_current: bmi?.current ?? null,
      bmi_change: bmi?.change ?? null,
      engagement_count: engagementCount,
      last_engagement: lastEngagement || null,
      engagement,
    };
  });

  const activeRoster = roster.filter((r) => r.status === 'active');
  const avgEngagementScore = avg(activeRoster.map((r) => r.engagement.score));
  const avgFoodLoggingPct = avg(activeRoster.map((r) => r.engagement.food_logging_pct));
  const redCount = activeRoster.filter((r) => r.engagement.color === 'red').length;
  const yellowCount = activeRoster.filter((r) => r.engagement.color === 'yellow').length;
  const insights = buildInsights(activeRoster);

  res.json({
    employer: { id: employer.id, name: employer.name },
    summary: {
      member_count: members.length,
      active_last_7_days: activeLast7,
      participation_rate: members.length ? activeLast7 / members.length : 0,
      avg_weight_change_pct: avgWeightChangePct,
      avg_body_fat_change: avgBodyFatChange,
      avg_current_bmi: avgCurrentBmi,
      avg_bmi_change: avgBmiChange,
      total_workouts_logged: totalWorkouts,
      avg_engagement_score: avgEngagementScore,
      avg_food_logging_pct: avgFoodLoggingPct,
      needs_attention: { count: redCount + yellowCount, red: redCount, yellow: yellowCount, total: activeRoster.length },
    },
    weekly_trend: weeklyTrend,
    weekly_bmi_trend: weeklyBmiTrend,
    roster,
    insights,
  });
});

router.get('/:employerId/members/:memberId', (req, res) => {
  const member = db
    .prepare('SELECT * FROM members WHERE id = ? AND employer_id = ?')
    .get(req.params.memberId, req.params.employerId);
  if (!member) return res.status(404).json({ error: 'not found' });

  const vitalsHistory = db
    .prepare('SELECT date, weight_lbs, body_fat_pct, muscle_mass_lbs FROM vitals WHERE member_id = ? ORDER BY date ASC')
    .all(member.id)
    .map((v) => ({ ...v, bmi: computeBmi(v.weight_lbs, member.height_in) }));

  const timeline = db
    .prepare('SELECT type, summary, created_at FROM engagements WHERE member_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(member.id);

  res.json({
    member: {
      id: member.id,
      name: member.name,
      program_start_date: member.program_start_date,
      gender: member.gender,
      age: member.age,
      height_in: member.height_in,
      activity_level: member.activity_level,
      dietary_preferences: member.dietary_preferences,
      starting_weight_lbs: member.starting_weight_lbs,
      starting_body_fat_pct: member.starting_body_fat_pct,
      starting_waist_in: member.starting_waist_in,
      goal_weight_lbs: member.goal_weight_lbs,
    },
    engagement: computeEngagement(member.id, member),
    food_logging_grid: foodLoggingGrid(member.id),
    vitals_history: vitalsHistory,
    timeline,
  });
});

module.exports = router;
