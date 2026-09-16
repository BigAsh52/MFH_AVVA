const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { DIRECT_CONSUMER_EMPLOYER_ID } = require('../db');
const { computeBmi, bmiCategory } = require('../lib/health');
const { getDailyMessage, dayNumberFor } = require('../lib/dailyMessages');
const { sendWelcomeLink } = require('../lib/welcome');

const router = express.Router();

// Public, unauthenticated list of real employer groups for the onboarding
// "which company is your program through?" dropdown. Excludes the Direct
// Consumers bucket — that's an internal staff concept, not something a
// member should be able to pick themselves.
router.get('/employers', (req, res) => {
  const rows = db
    .prepare('SELECT id, name FROM employers WHERE is_direct_consumer = 0 ORDER BY name ASC')
    .all();
  res.json(rows);
});

// Public, unauthenticated "I lost my link" resend — used by the Get the App
// page linked from medfit.health. Always returns the same generic message
// regardless of whether a match was found, so this can't be used to probe
// whether a given email/phone is enrolled.
router.post('/resend-link', async (req, res) => {
  const { email, phone } = req.body || {};
  const contact = (email || '').trim() || (phone || '').trim();
  if (!contact) return res.status(400).json({ error: 'email or phone is required' });

  const member = email
    ? db.prepare('SELECT * FROM members WHERE lower(email) = lower(?) AND status = ?').get(email.trim(), 'active')
    : db.prepare('SELECT * FROM members WHERE phone = ? AND status = ?').get(phone.trim(), 'active');

  if (member) {
    await sendWelcomeLink({ req, name: member.name, email: member.email, phone: member.phone, signupToken: member.signup_token });
  }

  // Same response either way — see comment above.
  res.json({ ok: true, message: "If we found an account for that email or phone, we've sent your app link." });
});

router.get('/resolve/:token', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE signup_token = ?').get(req.params.token);
  if (!member) return res.status(404).json({ error: 'not found' });
  res.json({ id: member.id, name: member.name, onboarding_completed: !!member.onboarding_completed_at });
});

// Baseline intake, filled in by the member the first time they open the
// app (checkout webhooks don't carry body-composition data). Writes the
// member's baseline fields and drops a Day-0 vitals entry so progress charts
// have a true starting point.
router.post('/:id/onboarding', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'not found' });

  const {
    gender,
    age,
    height_in,
    activity_level,
    dietary_preferences,
    goal_weight_lbs,
    starting_weight_lbs,
    starting_body_fat_pct,
    starting_muscle_mass_lbs,
    starting_waist_in,
    resting_heart_rate_bpm,
    employer_id,
    employer_name_other,
  } = req.body;

  // Employer self-report: either they picked a real group from the
  // dropdown, or their company wasn't listed and they typed it in. A typed
  // answer always wins over a picked one if somehow both are present —
  // it's the member telling us the list was wrong for them. The member is
  // parked in Direct Consumers either way until staff reviews it, so
  // nothing blocks their access in the meantime; see employer_requests in
  // db.js and the Requests tab in the admin panel.
  const typedEmployer = (employer_name_other || '').trim();
  if (typedEmployer) {
    db.prepare('UPDATE members SET employer_id = ? WHERE id = ?').run(DIRECT_CONSUMER_EMPLOYER_ID, member.id);
    db.prepare(
      `INSERT INTO employer_requests (id, member_id, requested_name) VALUES (?, ?, ?)`
    ).run(nanoid(), member.id, typedEmployer);
  } else if (employer_id) {
    const employer = db.prepare('SELECT id FROM employers WHERE id = ? AND is_direct_consumer = 0').get(employer_id);
    if (!employer) return res.status(400).json({ error: 'employer_id does not exist' });
    db.prepare('UPDATE members SET employer_id = ? WHERE id = ?').run(employer_id, member.id);
  }

  db.prepare(
    `UPDATE members SET
      gender = @gender,
      age = @age,
      height_in = @height_in,
      activity_level = @activity_level,
      dietary_preferences = @dietary_preferences,
      goal_weight_lbs = @goal_weight_lbs,
      starting_weight_lbs = COALESCE(@starting_weight_lbs, starting_weight_lbs),
      starting_body_fat_pct = COALESCE(@starting_body_fat_pct, starting_body_fat_pct),
      starting_muscle_mass_lbs = @starting_muscle_mass_lbs,
      starting_waist_in = @starting_waist_in,
      resting_heart_rate_bpm = @resting_heart_rate_bpm,
      onboarding_completed_at = datetime('now')
     WHERE id = @id`
  ).run({
    id: member.id,
    gender: gender || null,
    age: age || null,
    height_in: height_in || null,
    activity_level: activity_level || null,
    dietary_preferences: dietary_preferences || null,
    goal_weight_lbs: goal_weight_lbs || null,
    starting_weight_lbs: starting_weight_lbs || null,
    starting_body_fat_pct: starting_body_fat_pct || null,
    starting_muscle_mass_lbs: starting_muscle_mass_lbs || null,
    starting_waist_in: starting_waist_in || null,
    resting_heart_rate_bpm: resting_heart_rate_bpm || null,
  });

  if (starting_weight_lbs) {
    db.prepare(
      `INSERT INTO vitals (id, member_id, date, weight_lbs, body_fat_pct, muscle_mass_lbs)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      nanoid(),
      member.id,
      member.program_start_date || new Date().toISOString().slice(0, 10),
      starting_weight_lbs,
      starting_body_fat_pct || null,
      starting_muscle_mass_lbs || null
    );
  }

  db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, 'onboarding', ?)`).run(
    nanoid(),
    member.id,
    'Completed baseline intake'
  );

  res.json({ ok: true });
});

router.get('/:id/summary', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'not found' });

  const latestVitals = db
    .prepare('SELECT * FROM vitals WHERE member_id = ? ORDER BY date DESC LIMIT 1')
    .get(member.id);

  const vitalsHistory = db
    .prepare('SELECT date, weight_lbs, body_fat_pct, muscle_mass_lbs FROM vitals WHERE member_id = ? ORDER BY date ASC')
    .all(member.id);

  const workoutsThisWeek = db
    .prepare(
      `SELECT COUNT(*) as c FROM workouts WHERE member_id = ? AND date >= date('now', '-7 days')`
    )
    .get(member.id).c;

  const weekNumber = Math.max(
    1,
    Math.ceil((Date.now() - new Date(member.program_start_date).getTime()) / (7 * 24 * 3600 * 1000))
  );

  const startingBmi = computeBmi(member.starting_weight_lbs, member.height_in);
  const currentBmi = computeBmi(latestVitals?.weight_lbs, member.height_in);

  res.json({
    member: {
      id: member.id,
      name: member.name,
      program_start_date: member.program_start_date,
      diet_style: member.diet_style,
      week_number: weekNumber,
      gender: member.gender,
      age: member.age,
      height_in: member.height_in,
      activity_level: member.activity_level,
      dietary_preferences: member.dietary_preferences,
      goal_weight_lbs: member.goal_weight_lbs,
      onboarding_completed: !!member.onboarding_completed_at,
    },
    starting: {
      weight_lbs: member.starting_weight_lbs,
      body_fat_pct: member.starting_body_fat_pct,
      muscle_mass_lbs: member.starting_muscle_mass_lbs,
      waist_in: member.starting_waist_in,
      resting_heart_rate_bpm: member.resting_heart_rate_bpm,
      bmi: startingBmi,
    },
    latest: latestVitals || null,
    bmi: {
      current: currentBmi,
      starting: startingBmi,
      change: currentBmi != null && startingBmi != null ? +(currentBmi - startingBmi).toFixed(1) : null,
      category: bmiCategory(currentBmi),
    },
    vitals_history: vitalsHistory,
    workouts_this_week: workoutsThisWeek,
  });
});

// Today's message in the 30-day Reset check-in series, keyed off the
// member's own program_start_date. Returns { day: null } before day 1 or
// after day 30 (outside the 30-day series).
router.get('/:id/daily-message', (req, res) => {
  const member = db.prepare('SELECT id, program_start_date FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'not found' });

  const day = dayNumberFor(member.program_start_date);
  if (day == null || day < 1 || day > 30) {
    return res.json({ day: day ?? null, message: null });
  }
  const entry = getDailyMessage(day);
  res.json({ day, ...entry });
});

module.exports = router;
