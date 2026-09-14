const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const EMPLOYER_ID = 'demo-employer';

// A tiny placeholder JPEG used to seed demo progress photos (private to each
// member — see routes/photos.js). Not a real photo, just enough to populate
// the gallery UI for a demo.
const PLACEHOLDER_PHOTO_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAGQASwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCGiiivSPNCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9k=';


function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

db.exec('DELETE FROM chat_messages; DELETE FROM engagements; DELETE FROM workouts; DELETE FROM meals; DELETE FROM vitals; DELETE FROM progress_photos; DELETE FROM members; DELETE FROM employers;');

// Clear any previously-seeded demo photo files so re-running seed.js doesn't
// accumulate orphaned files under private_uploads/.
const progressPhotosRoot = path.join(__dirname, 'private_uploads', 'progress_photos');
fs.rmSync(progressPhotosRoot, { recursive: true, force: true });

db.prepare('INSERT INTO employers (id, name, glp_benefit_note) VALUES (?, ?, ?)').run(
  EMPLOYER_ID,
  'Cimarron Manufacturing Co.',
  'GLP-1 benefit continuation contingent on active lifestyle-program engagement'
);

const memberSeeds = [
  { name: 'Dana Whitfield', startWeight: 214, startFat: 38, trend: -0.9, active: true, gender: 'Female', age: 44, heightIn: 65, waist: 39, muscle: 68, rhr: 78, activity: 'lightly_active', diet: 'None', goal: 165 },
  { name: 'Marcus Ibe', startWeight: 251, startFat: 34, trend: -1.3, active: true, gender: 'Male', age: 39, heightIn: 71, waist: 44, muscle: 92, rhr: 82, activity: 'sedentary', diet: 'None', goal: 210 },
  { name: 'Priya Nandakumar', startWeight: 189, startFat: 41, trend: -0.6, active: true, gender: 'Female', age: 51, heightIn: 63, waist: 37, muscle: 58, rhr: 74, activity: 'sedentary', diet: 'Vegetarian', goal: 155 },
  { name: 'Tomas Reyes', startWeight: 227, startFat: 30, trend: -0.4, active: false, gender: 'Male', age: 47, heightIn: 69, waist: 41, muscle: 85, rhr: 80, activity: 'lightly_active', diet: 'None', goal: 195 },
  { name: 'Sherry Kowalczyk', startWeight: 203, startFat: 36, trend: -1.1, active: true, gender: 'Female', age: 36, heightIn: 66, waist: 38, muscle: 66, rhr: 76, activity: 'moderately_active', diet: 'Gluten-free', goal: 160 },
  { name: 'Andre Whitlock', startWeight: 264, startFat: 39, trend: -0.7, active: true, gender: 'Male', age: 54, heightIn: 73, waist: 47, muscle: 98, rhr: 84, activity: 'sedentary', diet: 'None', goal: 220 },
  { name: 'Leah Ferrante', startWeight: 176, startFat: 33, trend: -0.3, active: false, gender: 'Female', age: 29, heightIn: 64, waist: 34, muscle: 60, rhr: 72, activity: 'lightly_active', diet: 'Dairy-free', goal: 150 },
  { name: 'James Odum', startWeight: 241, startFat: 37, trend: -1.0, active: true, gender: 'Male', age: 42, heightIn: 70, waist: 45, muscle: 88, rhr: 79, activity: 'sedentary', diet: 'None', goal: 200 },
];

const MEAL_OPTIONS = [
  { d: 'Green liver-support shake + blueberries', type: 'breakfast', cal: 320, p: 24 },
  { d: 'Grilled chicken, arugula, roasted beets', type: 'lunch', cal: 410, p: 38 },
  { d: 'Herb-roasted salmon, charred broccoli', type: 'dinner', cal: 430, p: 40 },
  { d: 'Turkey & white bean skillet with kale', type: 'dinner', cal: 410, p: 38 },
  { d: 'Greek yogurt, walnuts, half grapefruit', type: 'snack', cal: 190, p: 14 },
];

const WORKOUT_OPTIONS = [
  { t: 'Brisk walk', cat: 'cardio', dur: 30 },
  { t: 'Resistance circuit', cat: 'resistance', dur: 40 },
  { t: 'Stationary bike', cat: 'cardio', dur: 25 },
  { t: 'Mobility / stretching', cat: 'flexibility', dur: 15 },
];

memberSeeds.forEach((seed, idx) => {
  const id = nanoid();
  const startDate = daysAgoISO(56 - idx); // stagger start dates a bit
  db.prepare(
    `INSERT INTO members (
      id, employer_id, name, email, phone, program_start_date, starting_weight_lbs, starting_body_fat_pct,
      status, signup_token, gender, age, height_in, starting_muscle_mass_lbs, starting_waist_in,
      resting_heart_rate_bpm, activity_level, dietary_preferences, goal_weight_lbs, onboarding_completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    EMPLOYER_ID,
    seed.name,
    `${seed.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    null,
    startDate,
    seed.startWeight,
    seed.startFat,
    seed.active ? 'active' : 'inactive',
    nanoid(24),
    seed.gender,
    seed.age,
    seed.heightIn,
    seed.muscle,
    seed.waist,
    seed.rhr,
    seed.activity,
    seed.diet,
    seed.goal
  );

  // 8 weekly vitals readings with a gentle downward trend + noise
  for (let w = 0; w < 8; w++) {
    const date = daysAgoISO(56 - w * 7);
    const noise = (Math.sin(idx + w) * 0.6);
    db.prepare(`INSERT INTO vitals (id, member_id, date, weight_lbs, body_fat_pct, muscle_mass_lbs) VALUES (?, ?, ?, ?, ?, ?)`).run(
      nanoid(),
      id,
      date,
      +(seed.startWeight + seed.trend * w + noise).toFixed(1),
      +(seed.startFat + seed.trend * 0.3 * w).toFixed(1),
      +(seed.startWeight * 0.32).toFixed(1)
    );
  }

  // idx 0 (Dana) is seeded as the "highly engaged" example — logs almost
  // every day — so the engagement-score demo shows the full range, not just
  // members who need a nudge.
  const isHeroEngager = idx === 0;
  const mealChance = isHeroEngager ? 0.95 : 0.6;
  const workoutChance = isHeroEngager ? 0.85 : 0.45;
  const dayStep = isHeroEngager ? 1 : undefined;

  if (seed.active) {
    // engagement over the last ~5 weeks
    for (let day = 0; day < 35; day += dayStep || (Math.random() > 0.5 ? 1 : 2)) {
      const date = daysAgoISO(day);
      if (Math.random() < mealChance) {
        const meal = MEAL_OPTIONS[Math.floor(Math.random() * MEAL_OPTIONS.length)];
        db.prepare(
          `INSERT INTO meals (id, member_id, date, meal_type, description, calories, protein_g) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(nanoid(), id, date, meal.type, meal.d, meal.cal, meal.p);
        db.prepare(`INSERT INTO engagements (id, member_id, type, summary, created_at) VALUES (?, ?, 'meal', ?, datetime(?))`).run(
          nanoid(), id, `Logged ${meal.type}: ${meal.d}`, date
        );
      }
      if (Math.random() < workoutChance) {
        const wo = WORKOUT_OPTIONS[Math.floor(Math.random() * WORKOUT_OPTIONS.length)];
        db.prepare(
          `INSERT INTO workouts (id, member_id, date, workout_type, category, duration_min, intensity) VALUES (?, ?, ?, ?, ?, ?, 'moderate')`
        ).run(nanoid(), id, date, wo.t, wo.cat, wo.dur);
        db.prepare(`INSERT INTO engagements (id, member_id, type, summary, created_at) VALUES (?, ?, 'workout', ?, datetime(?))`).run(
          nanoid(), id, `Logged ${wo.dur} min ${wo.t}`, date
        );
      }
    }
  } else {
    // one stale engagement weeks ago
    const date = daysAgoISO(24);
    db.prepare(`INSERT INTO engagements (id, member_id, type, summary, created_at) VALUES (?, ?, 'meal', ?, datetime(?))`).run(
      nanoid(), id, 'Logged lunch', date
    );
  }
});

// One onboarded member still early in their 30-day Reset window, so the
// "Today" daily-message card has something to show in a fresh demo.
const earlyMemberId = nanoid();
const earlyMemberToken = nanoid(24);
db.prepare(
  `INSERT INTO members (
    id, employer_id, name, email, program_start_date, starting_weight_lbs, starting_body_fat_pct,
    status, signup_token, gender, age, height_in, starting_muscle_mass_lbs, starting_waist_in,
    resting_heart_rate_bpm, activity_level, dietary_preferences, goal_weight_lbs, onboarding_completed_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
).run(
  earlyMemberId, EMPLOYER_ID, 'Omar Chen', 'omar.chen@example.com', daysAgoISO(8), 232, 35,
  earlyMemberToken, 'Male', 37, 70, 82, 42, 77, 'lightly_active', 'None', 205
);
db.prepare(`INSERT INTO vitals (id, member_id, date, weight_lbs, body_fat_pct, muscle_mass_lbs) VALUES (?, ?, ?, ?, ?, ?)`).run(
  nanoid(), earlyMemberId, daysAgoISO(8), 232, 35, 82
);
db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, 'onboarding', 'Completed baseline intake')`).run(nanoid(), earlyMemberId);
db.prepare(`INSERT INTO meals (id, member_id, date, meal_type, description, calories, protein_g) VALUES (?, ?, ?, 'breakfast', 'Green liver-support shake', 320, 24)`).run(nanoid(), earlyMemberId, daysAgoISO(1));
db.prepare(`INSERT INTO engagements (id, member_id, type, summary, created_at) VALUES (?, ?, 'meal', 'Logged breakfast: Green liver-support shake', datetime(?))`).run(nanoid(), earlyMemberId, daysAgoISO(1));

// One brand-new signup with no baseline yet, to demo the onboarding flow.
const newMemberId = nanoid();
const newMemberToken = nanoid(24);
db.prepare(
  `INSERT INTO members (id, employer_id, name, email, program_start_date, status, signup_token)
   VALUES (?, ?, ?, ?, ?, 'active', ?)`
).run(newMemberId, EMPLOYER_ID, 'Kayla Brennan', 'kayla.brennan@example.com', daysAgoISO(0), newMemberToken);
db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, 'signup', 'Checkout completed, welcome message dispatched')`).run(nanoid(), newMemberId);

const firstMember = db.prepare('SELECT id, signup_token FROM members WHERE id != ? LIMIT 1').get(newMemberId);

// Seed a couple of demo progress photos for the first onboarded member, so
// the Progress tab's photo gallery isn't empty in a fresh demo. These are
// private to the member (see routes/photos.js) — never surfaced anywhere in
// the employer console.
const photoDir = path.join(__dirname, 'private_uploads', 'progress_photos', firstMember.id);
fs.mkdirSync(photoDir, { recursive: true });
const photoBuffer = Buffer.from(PLACEHOLDER_PHOTO_JPEG_B64, 'base64');
[
  { type: 'baseline', takenOn: daysAgoISO(56), filename: 'baseline.jpg' },
  { type: 'monthly', takenOn: daysAgoISO(28), filename: 'monthly-1.jpg' },
  { type: 'monthly', takenOn: daysAgoISO(0), filename: 'monthly-2.jpg' },
].forEach((p) => {
  const filePath = path.join(photoDir, p.filename);
  fs.writeFileSync(filePath, photoBuffer);
  db.prepare(
    `INSERT INTO progress_photos (id, member_id, photo_type, taken_on, file_path, mime_type) VALUES (?, ?, ?, ?, ?, 'image/jpeg')`
  ).run(nanoid(), firstMember.id, p.type, p.takenOn, filePath);
});

console.log('Seeded demo data.');
console.log('Employer ID:', EMPLOYER_ID);
console.log('Member 9 days into their Reset, for the daily-message demo (for /app/?demo=):', earlyMemberId);
console.log('Sample onboarded member ID (for /app/?demo=):', firstMember.id);
console.log('Sample onboarded signup token (for /app/welcome.html?t=):', firstMember.signup_token);
console.log('Fresh (not yet onboarded) signup token (for /app/welcome.html?t=):', newMemberToken);
