// One-time bootstrap for the very first staff account — there's no admin
// account yet to log in and create one, so this runs from the command line
// instead. After the first account exists, staff can create more from
// inside the Admin panel (Staff tab) without needing shell access again.
//
// Usage:
//   node create-admin.js "James Ashford" james@verus-strategies.com "a strong password"
//
// On Render: Manage > Shell (or a One-Off Job) in the service dashboard,
// same command.

require('dotenv').config();
const { nanoid } = require('nanoid');
const db = require('./db');
const { hashPassword } = require('./lib/auth');

const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node create-admin.js "Full Name" email@example.com "password"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const existing = db.prepare('SELECT id FROM admin_users WHERE lower(email) = lower(?)').get(email);
if (existing) {
  console.error(`An admin account already exists for ${email}.`);
  process.exit(1);
}

db.prepare('INSERT INTO admin_users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(
  nanoid(),
  name,
  email,
  hashPassword(password)
);

console.log(`Staff account created for ${name} <${email}>. They can now log in at /admin/login.html.`);
