const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

function logEngagement(member_id, type, summary) {
  db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, ?, ?)`).run(
    nanoid(),
    member_id,
    type,
    summary
  );
}

router.post('/meals', (req, res) => {
  const { member_id, date, meal_type, description, calories, protein_g, carbs_g, fat_g, photo_note } = req.body;
  if (!member_id || !description) return res.status(400).json({ error: 'member_id and description are required' });
  const id = nanoid();
  db.prepare(
    `INSERT INTO meals (id, member_id, date, meal_type, description, calories, protein_g, carbs_g, fat_g, photo_note)
     VALUES (@id, @member_id, @date, @meal_type, @description, @calories, @protein_g, @carbs_g, @fat_g, @photo_note)`
  ).run({
    id,
    member_id,
    date: date || new Date().toISOString().slice(0, 10),
    meal_type: meal_type || 'meal',
    description,
    calories: calories || null,
    protein_g: protein_g || null,
    carbs_g: carbs_g || null,
    fat_g: fat_g || null,
    photo_note: photo_note || null,
  });
  logEngagement(member_id, 'meal', `Logged ${meal_type || 'a meal'}: ${description}`);
  res.json({ id });
});

router.get('/meals/:memberId', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM meals WHERE member_id = ? ORDER BY date DESC, created_at DESC LIMIT 30')
    .all(req.params.memberId);
  res.json(rows);
});

router.post('/workouts', (req, res) => {
  const { member_id, date, workout_type, category, duration_min, intensity } = req.body;
  if (!member_id || !workout_type) return res.status(400).json({ error: 'member_id and workout_type are required' });
  const id = nanoid();
  db.prepare(
    `INSERT INTO workouts (id, member_id, date, workout_type, category, duration_min, intensity)
     VALUES (@id, @member_id, @date, @workout_type, @category, @duration_min, @intensity)`
  ).run({
    id,
    member_id,
    date: date || new Date().toISOString().slice(0, 10),
    workout_type,
    category: category || 'cardio',
    duration_min: duration_min || null,
    intensity: intensity || 'moderate',
  });
  logEngagement(member_id, 'workout', `Logged ${duration_min || '?'} min ${workout_type} (${category || 'cardio'})`);
  res.json({ id });
});

router.get('/workouts/:memberId', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM workouts WHERE member_id = ? ORDER BY date DESC, created_at DESC LIMIT 30')
    .all(req.params.memberId);
  res.json(rows);
});

router.post('/vitals', (req, res) => {
  const { member_id, date, weight_lbs, body_fat_pct, muscle_mass_lbs } = req.body;
  if (!member_id) return res.status(400).json({ error: 'member_id is required' });
  const id = nanoid();
  db.prepare(
    `INSERT INTO vitals (id, member_id, date, weight_lbs, body_fat_pct, muscle_mass_lbs)
     VALUES (@id, @member_id, @date, @weight_lbs, @body_fat_pct, @muscle_mass_lbs)`
  ).run({
    id,
    member_id,
    date: date || new Date().toISOString().slice(0, 10),
    weight_lbs: weight_lbs || null,
    body_fat_pct: body_fat_pct || null,
    muscle_mass_lbs: muscle_mass_lbs || null,
  });
  logEngagement(
    member_id,
    'vitals',
    `Logged vitals — ${weight_lbs ? weight_lbs + ' lbs' : ''}${body_fat_pct ? `, ${body_fat_pct}% body fat` : ''}`
  );
  res.json({ id });
});

module.exports = router;
