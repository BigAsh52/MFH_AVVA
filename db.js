const path = require('path');
const Database = require('better-sqlite3');

// In production (Render), DATA_DIR points at the mounted persistent disk
// (/var/data) so the database survives deploys. Without it (local dev),
// the db file just lives next to the code like before.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(DATA_DIR, 'medfit.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS employers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  glp_benefit_note TEXT,
  is_direct_consumer INTEGER DEFAULT 0,
  signup_code TEXT
);

-- MedFit staff who can log into /admin and /employer (real accounts, not
-- the one-time member signup links). Bootstrapped with create-admin.js
-- since there's no account yet to log in and create the first one.
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- DB-backed sessions for admin_users (so logins survive a server restart,
-- unlike an in-memory session store). Looked up by the id stored in the
-- httpOnly session cookie — see lib/auth.js.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT REFERENCES admin_users(id),
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  employer_id TEXT REFERENCES employers(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  diet_style TEXT DEFAULT 'metabolism-reset',
  program_start_date TEXT,
  starting_weight_lbs REAL,
  starting_body_fat_pct REAL,
  status TEXT DEFAULT 'active',
  signup_token TEXT,
  gender TEXT,
  age INTEGER,
  height_in REAL,
  starting_muscle_mass_lbs REAL,
  starting_waist_in REAL,
  resting_heart_rate_bpm REAL,
  activity_level TEXT,
  dietary_preferences TEXT,
  goal_weight_lbs REAL,
  onboarding_completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vitals (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),
  date TEXT NOT NULL,
  weight_lbs REAL,
  body_fat_pct REAL,
  muscle_mass_lbs REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),
  date TEXT NOT NULL,
  meal_type TEXT,
  description TEXT,
  calories REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  photo_note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),
  date TEXT NOT NULL,
  workout_type TEXT,
  category TEXT,
  duration_min REAL,
  intensity TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),
  role TEXT,
  content TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engagements (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),
  type TEXT NOT NULL,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Progress photos are member-private. Nothing in routes/employer.js should
-- ever query this table or reference file_path/photo ids in any response —
-- see the comment at the top of routes/employer.js.
CREATE TABLE IF NOT EXISTS progress_photos (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),
  photo_type TEXT NOT NULL, -- 'baseline' | 'monthly'
  taken_on TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Idempotency for inbound checkout-platform webhooks (Remedora retries a
-- delivery up to 4 times with the same delivery_id on a non-2xx response).
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY, -- "<source>:<delivery_id>"
  source TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  event TEXT,
  received_at TEXT DEFAULT (datetime('now'))
);

-- Tracks which of the 30-day Reset check-in messages (lib/dailyMessages.js)
-- have already gone out to each member, so the daily send script (see
-- send-daily-messages.js) is safe to run more than once on the same day.
-- Deliberately NOT the same as the engagements table above — a system-sent
-- message isn't a member action and shouldn't feed the employer
-- engagement-score/recency calculation (see lib/engagement.js).
CREATE TABLE IF NOT EXISTS daily_message_log (
  id TEXT PRIMARY KEY, -- "<member_id>:<day>"
  member_id TEXT REFERENCES members(id),
  day INTEGER NOT NULL,
  sent_at TEXT DEFAULT (datetime('now'))
);

-- A member's free-text "my company isn't listed" answer at onboarding (see
-- routes/members.js, the employer_name_other field). Staff review these in
-- the admin panel's Requests tab and either assign the member to an
-- existing group or create a new one — see routes/admin.js. The member is
-- parked in the Direct Consumers bucket in the meantime, not left
-- unassigned, so their dashboard access isn't blocked while this is
-- pending.
CREATE TABLE IF NOT EXISTS employer_requests (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),
  requested_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'reviewed'
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES admin_users(id)
);
`);

// Idempotent migration for databases created before the baseline-intake
// fields existed. Each ADD COLUMN is wrapped individually so re-running is
// harmless once the columns are already there.
const MEMBER_COLUMNS_MIGRATION = [
  'ALTER TABLE members ADD COLUMN gender TEXT',
  'ALTER TABLE members ADD COLUMN age INTEGER',
  'ALTER TABLE members ADD COLUMN height_in REAL',
  'ALTER TABLE members ADD COLUMN starting_muscle_mass_lbs REAL',
  'ALTER TABLE members ADD COLUMN starting_waist_in REAL',
  'ALTER TABLE members ADD COLUMN resting_heart_rate_bpm REAL',
  'ALTER TABLE members ADD COLUMN activity_level TEXT',
  'ALTER TABLE members ADD COLUMN dietary_preferences TEXT',
  'ALTER TABLE members ADD COLUMN goal_weight_lbs REAL',
  'ALTER TABLE members ADD COLUMN onboarding_completed_at TEXT',
];
for (const stmt of MEMBER_COLUMNS_MIGRATION) {
  try {
    db.exec(stmt);
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err;
  }
}

// Idempotent migration for databases created before is_direct_consumer existed.
try {
  db.exec('ALTER TABLE employers ADD COLUMN is_direct_consumer INTEGER DEFAULT 0');
} catch (err) {
  if (!/duplicate column/i.test(err.message)) throw err;
}

// Idempotent migration for databases created before signup_code existed —
// the employer-driven self-serve signup link (see routes/members.js
// self-signup and routes/admin.js signup-code endpoints). Employers with a
// standalone (non-GLP) Avva arrangement get one so their employees can join
// themselves without a Remedora checkout, billed to the employer separately
// (PEPM invoicing) rather than through the app.
try {
  db.exec('ALTER TABLE employers ADD COLUMN signup_code TEXT');
} catch (err) {
  if (!/duplicate column/i.test(err.message)) throw err;
}
// A plain (non-partial) unique index still allows unlimited NULLs in
// SQLite — only non-null signup_code values collide — so this is safe for
// the many employers that never enable self-serve signup.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_employers_signup_code ON employers(signup_code)');

// A single pooled "employer" bucket for people who bought the program
// directly (no employer sponsor) — reviewed internally by MedFit staff the
// same way a real employer's roster is, per James's direction. Every
// direct-consumer member gets employer_id = DIRECT_CONSUMER_EMPLOYER_ID.
const DIRECT_CONSUMER_EMPLOYER_ID = 'direct-consumers';
db.prepare(
  `INSERT INTO employers (id, name, glp_benefit_note, is_direct_consumer)
   VALUES (?, 'Direct Consumers', 'Self-pay members with no employer sponsor — reviewed internally by MedFit staff.', 1)
   ON CONFLICT(id) DO NOTHING`
).run(DIRECT_CONSUMER_EMPLOYER_ID);

module.exports = db;
module.exports.DIRECT_CONSUMER_EMPLOYER_ID = DIRECT_CONSUMER_EMPLOYER_ID;
