// Staff-only admin API: login, employer-group management, cross-employer
// member roster + reassignment, manual signup-link invites, and staff
// account management. Everything here is gated by requireStaffAuth except
// /login — see server.js for how the middleware is wired up.

const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { DIRECT_CONSUMER_EMPLOYER_ID } = require('../db');
const {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  requireStaffAuth,
  parseCookies,
} = require('../lib/auth');
const { sendWelcomeLink } = require('../lib/welcome');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM admin_users WHERE lower(email) = lower(?)').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const session = createSession(user.id);
  setSessionCookie(req, res, session);
  res.json({ id: user.id, name: user.name, email: user.email });
});

router.post('/logout', (req, res) => {
  const cookies = parseCookies(req);
  destroySession(cookies['avva_staff_session']);
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Everything below requires a logged-in staff session.
router.use(requireStaffAuth);

router.get('/me', (req, res) => {
  res.json(req.staffUser);
});

// ---- Employer groups ----

router.get('/employers', (req, res) => {
  const rows = db
    .prepare(
      `SELECT employers.*, COUNT(members.id) as member_count
       FROM employers LEFT JOIN members ON members.employer_id = employers.id
       GROUP BY employers.id
       ORDER BY employers.is_direct_consumer ASC, employers.name ASC`
    )
    .all();
  res.json(rows);
});

router.post('/employers', (req, res) => {
  const { name, glp_benefit_note } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const id = nanoid();
  db.prepare('INSERT INTO employers (id, name, glp_benefit_note, is_direct_consumer) VALUES (?, ?, ?, 0)').run(
    id,
    name.trim(),
    glp_benefit_note || null
  );
  res.json({ id, name: name.trim(), glp_benefit_note: glp_benefit_note || null, is_direct_consumer: 0 });
});

router.patch('/employers/:id', (req, res) => {
  const employer = db.prepare('SELECT * FROM employers WHERE id = ?').get(req.params.id);
  if (!employer) return res.status(404).json({ error: 'not found' });
  if (employer.is_direct_consumer) {
    return res.status(400).json({ error: 'The Direct Consumers bucket cannot be renamed or edited.' });
  }

  const { name, glp_benefit_note } = req.body || {};
  db.prepare('UPDATE employers SET name = COALESCE(?, name), glp_benefit_note = ? WHERE id = ?').run(
    name && name.trim() ? name.trim() : null,
    glp_benefit_note ?? employer.glp_benefit_note,
    employer.id
  );
  res.json({ ok: true });
});

// ---- Cross-employer member roster ----

router.get('/members', (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(
        `SELECT members.id, members.name, members.email, members.phone, members.status,
                members.employer_id, members.program_start_date, members.signup_token,
                employers.name as employer_name, employers.is_direct_consumer
         FROM members JOIN employers ON employers.id = members.employer_id
         WHERE members.name LIKE ? OR members.email LIKE ? OR members.phone LIKE ?
         ORDER BY members.created_at DESC LIMIT 200`
      )
      .all(like, like, like);
  } else {
    rows = db
      .prepare(
        `SELECT members.id, members.name, members.email, members.phone, members.status,
                members.employer_id, members.program_start_date, members.signup_token,
                employers.name as employer_name, employers.is_direct_consumer
         FROM members JOIN employers ON employers.id = members.employer_id
         ORDER BY members.created_at DESC LIMIT 200`
      )
      .all();
  }
  res.json(rows);
});

router.patch('/members/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'not found' });

  const { employer_id, status } = req.body || {};
  if (employer_id) {
    const employer = db.prepare('SELECT id FROM employers WHERE id = ?').get(employer_id);
    if (!employer) return res.status(400).json({ error: 'employer_id does not exist' });
  }

  db.prepare('UPDATE members SET employer_id = COALESCE(?, employer_id), status = COALESCE(?, status) WHERE id = ?').run(
    employer_id || null,
    status || null,
    member.id
  );

  if (employer_id && employer_id !== member.employer_id) {
    db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, 'admin', ?)`).run(
      nanoid(),
      member.id,
      `Reassigned to a different group by staff (${req.staffUser.name})`
    );
  }

  res.json({ ok: true });
});

// Manually invite someone who isn't coming through the Remedora checkout —
// e.g. a phone signup, a walk-in, or fixing a person Remedora never sent a
// webhook for. Creates the member record and sends the same welcome link
// the checkout webhook sends, immediately.
router.post('/members', async (req, res) => {
  const { name, email, phone, employer_id } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (!email && !phone) return res.status(400).json({ error: 'email or phone is required' });

  let resolvedEmployerId = employer_id || DIRECT_CONSUMER_EMPLOYER_ID;
  const employer = db.prepare('SELECT id FROM employers WHERE id = ?').get(resolvedEmployerId);
  if (!employer) return res.status(400).json({ error: 'employer_id does not exist' });

  const id = nanoid();
  const signup_token = nanoid(24);
  const program_start_date = new Date().toISOString().slice(0, 10);

  db.prepare(
    `INSERT INTO members (id, employer_id, name, email, phone, program_start_date, status, signup_token)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
  ).run(id, resolvedEmployerId, name.trim(), email || null, phone || null, program_start_date, signup_token);

  const { link, results } = await sendWelcomeLink({ req, name: name.trim(), email, phone, signupToken: signup_token });

  db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, 'signup', ?)`).run(
    nanoid(),
    id,
    `Manually invited by staff (${req.staffUser.name})`
  );

  res.json({ member_id: id, employer_id: resolvedEmployerId, link, notifications: results });
});

// Resend an existing member's (unchanged) signup link — e.g. the original
// text/email never arrived or they lost it.
router.post('/members/:id/resend', async (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'not found' });
  if (!member.email && !member.phone) return res.status(400).json({ error: 'member has no email or phone on file' });

  const { link, results } = await sendWelcomeLink({
    req,
    name: member.name,
    email: member.email,
    phone: member.phone,
    signupToken: member.signup_token,
  });
  res.json({ link, notifications: results });
});

// ---- Staff accounts ----

router.get('/staff', (req, res) => {
  res.json(db.prepare('SELECT id, name, email, created_at FROM admin_users ORDER BY created_at ASC').all());
});

router.post('/staff', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM admin_users WHERE lower(email) = lower(?)').get(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const id = nanoid();
  db.prepare('INSERT INTO admin_users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(
    id,
    name.trim(),
    email.trim(),
    hashPassword(password)
  );
  res.json({ id, name: name.trim(), email: email.trim() });
});

module.exports = router;
