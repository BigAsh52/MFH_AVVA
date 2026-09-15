// Staff login for /admin and /employer — real individual accounts (not the
// member one-time signup links, which are a separate, unrelated mechanism).
// Sessions are stored in the `sessions` table (see db.js) rather than kept
// in memory, so a login survives a server restart/redeploy.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');

const SESSION_COOKIE = 'avva_staff_session';
const SESSION_DAYS = 14;

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Minimal cookie parsing/serialization — avoids adding a dependency for
// something this small. Only handles what we need: one httpOnly cookie.
function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((pair) => {
      const idx = pair.indexOf('=');
      const key = decodeURIComponent(pair.slice(0, idx).trim());
      const val = decodeURIComponent(pair.slice(idx + 1).trim());
      return [key, val];
    })
  );
}

function createSession(adminUserId) {
  const id = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, admin_user_id, expires_at) VALUES (?, ?, ?)').run(
    id,
    adminUserId,
    expires
  );
  return { id, expires };
}

function destroySession(sessionId) {
  if (!sessionId) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return null;

  const row = db
    .prepare(
      `SELECT admin_users.id, admin_users.name, admin_users.email
       FROM sessions JOIN admin_users ON admin_users.id = sessions.admin_user_id
       WHERE sessions.id = ? AND sessions.expires_at > datetime('now')`
    )
    .get(sessionId);
  return row || null;
}

function setSessionCookie(req, res, session) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE}=${session.id}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Expires=${new Date(session.expires).toUTCString()}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

// Attaches req.staffUser when a valid session cookie is present; does not
// itself reject the request. Use requireStaffAuth to actually gate a route.
function attachStaffUser(req, res, next) {
  req.staffUser = getSessionUser(req);
  next();
}

// For API routes: 401 JSON if not logged in.
function requireStaffAuth(req, res, next) {
  if (!req.staffUser) return res.status(401).json({ error: 'not logged in' });
  next();
}

// For static pages (the /admin and /employer HTML): redirect to the login
// page instead of a bare 401, so the browser doesn't just render a JSON blob.
function requireStaffAuthPage(loginPath) {
  return (req, res, next) => {
    if (!req.staffUser) return res.redirect(loginPath);
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie,
  attachStaffUser,
  requireStaffAuth,
  requireStaffAuthPage,
  parseCookies,
};
