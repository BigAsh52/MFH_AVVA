require('dotenv').config();
const express = require('express');
const path = require('path');

require('./db'); // ensures schema exists

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

app.use('/api/checkout', require('./routes/checkout'));
app.use('/api/members', require('./routes/members'));
app.use('/api/engagement', require('./routes/engagement'));
app.use('/api/coach', require('./routes/coach'));
app.use('/api/employer', require('./routes/employer'));
app.use('/api/photos', require('./routes/photos'));

app.use('/app', express.static(path.join(__dirname, 'public/member')));
app.use('/employer', express.static(path.join(__dirname, 'public/employer')));

app.get('/', (req, res) => {
  res.redirect('/app/');
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3210;
app.listen(PORT, () => {
  console.log(`Avva (by MedFit) running at http://localhost:${PORT}`);
  console.log(`  Member app:       http://localhost:${PORT}/app/`);
  console.log(`  Employer console: http://localhost:${PORT}/employer/`);
});
