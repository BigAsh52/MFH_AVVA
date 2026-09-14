// Engagement scoring for the employer console's coaching-triage view.
//
// This is an original scoring model — inspired by the general idea of
// giving coaches a quick "who needs a nudge" signal, not copied from any
// third-party tool. It's intentionally simple and documented in full here
// so MedFit's team can adjust the weights as they see what correlates with
// real outcomes.
//
// Score (0-100) blends four signals over a trailing window:
//   - Food logging density (55%): % of days in the window with >=1 meal logged
//   - Weigh-in activity (20%): at least a weekly weigh-in cadence gets full credit
//   - Workout logging density (15%): % of days with a workout logged
//   - Recency (10%, can also go negative): a bonus for logging very recently,
//     a growing penalty the longer it's been since ANY engagement
//
// Band thresholds: >=70 Engaged (green), 40-69 Needs a nudge (yellow),
// <40 Disengaged (red) — except a member still inside their first 3 days
// with no engagement yet, who reads as "New" rather than red.

const db = require('../db');

const WINDOW_DAYS_MAX = 30;
const WINDOW_DAYS_MIN = 7;

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function windowDaysFor(member) {
  if (!member.program_start_date) return WINDOW_DAYS_MAX;
  const started = daysBetween(new Date(), new Date(member.program_start_date));
  return Math.min(WINDOW_DAYS_MAX, Math.max(WINDOW_DAYS_MIN, started + 1));
}

function distinctDaysWithRows(rows) {
  return new Set(rows.map((r) => r.date)).size;
}

function attentionBand(score, { isNew }) {
  if (isNew) return { label: 'New', color: 'new' };
  if (score >= 70) return { label: 'Engaged', color: 'green' };
  if (score >= 40) return { label: 'Needs a nudge', color: 'yellow' };
  return { label: 'Disengaged', color: 'red' };
}

function computeEngagement(memberId, member) {
  const windowDays = windowDaysFor(member);
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().slice(0, 10);

  const meals = db
    .prepare('SELECT date FROM meals WHERE member_id = ? AND date >= ?')
    .all(memberId, sinceStr);
  const workouts = db
    .prepare('SELECT date FROM workouts WHERE member_id = ? AND date >= ?')
    .all(memberId, sinceStr);
  const vitals = db
    .prepare('SELECT date FROM vitals WHERE member_id = ? AND date >= ? AND weight_lbs IS NOT NULL')
    .all(memberId, sinceStr);
  const lastEngagement = db
    .prepare('SELECT created_at FROM engagements WHERE member_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(memberId);

  const foodDays = distinctDaysWithRows(meals);
  const foodPct = Math.min(1, foodDays / windowDays);

  const workoutDays = distinctDaysWithRows(workouts);
  const workoutPct = Math.min(1, workoutDays / windowDays);

  const expectedWeighIns = Math.max(1, Math.round(windowDays / 7)); // ~weekly cadence
  const weighInPct = Math.min(1, vitals.length / expectedWeighIns);

  let daysSinceLastEngagement = null;
  let recencyPoints = -20; // no engagement on record at all
  if (lastEngagement?.created_at) {
    daysSinceLastEngagement = daysBetween(new Date(), new Date(lastEngagement.created_at.replace(' ', 'T') + 'Z'));
    if (daysSinceLastEngagement <= 1) recencyPoints = 10;
    else if (daysSinceLastEngagement <= 3) recencyPoints = 5;
    else if (daysSinceLastEngagement <= 7) recencyPoints = 0;
    else if (daysSinceLastEngagement <= 14) recencyPoints = -10;
    else recencyPoints = -20;
  }

  const rawScore = foodPct * 55 + weighInPct * 20 + workoutPct * 15 + recencyPoints;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  const daysSinceStart = member.program_start_date ? daysBetween(new Date(), new Date(member.program_start_date)) : null;
  const isNew = daysSinceStart != null && daysSinceStart < 3 && !lastEngagement;

  const band = attentionBand(score, { isNew });

  return {
    score,
    band: band.label,
    color: band.color,
    window_days: windowDays,
    food_logging_days: foodDays,
    food_logging_pct: +(foodPct * 100).toFixed(0),
    weigh_ins: vitals.length,
    workout_days: workoutDays,
    days_since_last_engagement: daysSinceLastEngagement,
  };
}

// A compact day-by-day grid (oldest -> newest) of whether a meal was logged
// that day, for the drill-down's food-logging visualization.
function foodLoggingGrid(memberId, days = 21) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10);
  const rows = db
    .prepare('SELECT DISTINCT date FROM meals WHERE member_id = ? AND date >= ?')
    .all(memberId, sinceStr);
  const loggedDates = new Set(rows.map((r) => r.date));
  const grid = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    grid.push({ date: dateStr, logged: loggedDates.has(dateStr) });
  }
  return grid;
}

module.exports = { computeEngagement, foodLoggingGrid };
