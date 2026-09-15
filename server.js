require('dotenv').config();
const express = require('express');
const path = require('path');

require('./db'); // ensures schema exists
const { attachStaffUser, requireStaffAuth, requireStaffAuthPage } = require('./lib/auth');

const app = express();

// Keep the raw request body around for webhook signature verification
// (Remedora signs the exact bytes received, not the re-serialized JSON).
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Reads the staff session cookie (if any) onto req.staffUser for every
// request. Doesn't reject anything by itself — requireStaffAuth /
// requireStaffAuthPage below do that where it's actually needed.
app.use(attachStaffUser);

app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/members', require('./routes/members'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/coach', require('./routes/coach'));
app.use('/api/employer', requireStaffAuth, require('./routes/employer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/photos', require('./routes/photos'));

app.use('/app', express.static(path.join(__dirname, 'public/member')));

// The login page has to be reachable without a session (it's how you get
// one), so it's served explicitly before the guarded /admin and /employer
// static mounts below rather than living inside either protected tree.
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});

app.use('/admin', requireStaffAuthPage('/admin/login.html'), express.static(path.join(__dirname, 'public/admin')));
app.use('/employer', requireStaffAuthPage('/admin/login.html'), express.static(path.join(__dirname, 'public/employer')));

app.use('/', express.static(path.join(__dirname, 'public/site')));

app.get('/', (req, res) => {
  res.redirect('/get-app.html');
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3210;
app.listen(PORT, () => {
  console.log(`Avva (by MedFit) running at http://localhost:${PORT}`);
  console.log(`  Member app:       http://localhost:${PORT}/app/`);
  console.log(`  Employer console: http://localhost:${PORT}/employer/`);
});
