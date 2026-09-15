const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { sendWelcomeLink } = require('../lib/welcome');
const { verifySignature, mapCheckoutCompleted } = require('../lib/remedora');

const router = express.Router();

function findOrCreateEmployer(signal) {
  if (!signal?.name) return null;
  const existing = db
    .prepare('SELECT id FROM employers WHERE lower(name) = lower(?)')
    .get(signal.name);
  if (existing) return existing.id;

  const id = nanoid();
  db.prepare('INSERT INTO employers (id, name, glp_benefit_note) VALUES (?, ?, ?)').run(
    id,
    signal.name,
    signal.source === 'funnel_fallback'
      ? 'Auto-created from Remedora funnel name — no explicit employer field in the webhook; verify this is correct.'
      : null
  );
  return id;
}

// Remedora's real checkout_completed webhook. See lib/remedora.js for the
// payload notes and the open question about employer attribution.
//
// POST /api/checkout/webhook
// Headers: X-Remedora-Event, X-Remedora-Delivery, X-Remedora-Timestamp, X-Remedora-Signature
router.post('/webhook', async (req, res) => {
  const event = req.headers['x-remedora-event'];
  const deliveryId = req.headers['x-remedora-delivery'];
  const timestamp = req.headers['x-remedora-timestamp'];
  const signature = req.headers['x-remedora-signature'];

  const sig = verifySignature({
    rawBody: req.rawBody,
    timestamp,
    signatureHeader: signature,
    signingSecret: process.env.REMEDORA_SIGNING_SECRET,
  });
  if (!sig.ok) {
    if (process.env.REMEDORA_SIGNING_SECRET) {
      // A real secret is configured and the signature didn't check out — reject.
      return res.status(401).json({ error: 'invalid signature' });
    }
    // No secret configured yet (dev/demo mode) — proceed, but say so.
    console.warn('REMEDORA_SIGNING_SECRET not set — accepting webhook without verification (dev mode only).');
  }

  const body = req.body || {};
  if (body.event && body.event !== event) {
    console.warn(`X-Remedora-Event header (${event}) does not match body.event (${body.event})`);
  }

  if (body.is_test) {
    return res.json({ ok: true, test: true, note: 'Test delivery acknowledged, no member created.' });
  }

  if (deliveryId) {
    const dedupeKey = `remedora:${deliveryId}`;
    const already = db.prepare('SELECT id FROM webhook_deliveries WHERE id = ?').get(dedupeKey);
    if (already) {
      return res.json({ ok: true, duplicate: true });
    }
    db.prepare('INSERT INTO webhook_deliveries (id, source, delivery_id, event) VALUES (?, ?, ?, ?)').run(
      dedupeKey,
      'remedora',
      deliveryId,
      body.event || event
    );
  }

  if (body.event !== 'checkout_completed') {
    // We only act on checkout_completed today; anything else this endpoint
    // is subscribed to is acknowledged and ignored.
    return res.json({ ok: true, ignored: body.event || event });
  }

  if (!body.meta?.includes_medical_data) {
    // Without data.patient (email/phone/name) we have no way to create an
    // account or send a welcome message. This endpoint needs "medical data"
    // enabled in Remedora's webhook settings for this to work.
    return res.status(422).json({
      error: 'This webhook delivery has meta.includes_medical_data=false, so it has no patient contact info to act on. Enable medical data for this endpoint in Remedora.',
    });
  }

  const mapped = mapCheckoutCompleted(body.data || {});
  if (!mapped.name || (!mapped.email && !mapped.phone)) {
    return res.status(422).json({ error: 'Payload is missing patient name and email/phone.' });
  }

  const employer_id = findOrCreateEmployer(mapped.employerSignal);

  const id = nanoid();
  const signup_token = nanoid(24);
  const program_start_date = new Date().toISOString().slice(0, 10);

  db.prepare(
    `INSERT INTO members (id, employer_id, name, email, phone, program_start_date, status, signup_token)
     VALUES (@id, @employer_id, @name, @email, @phone, @program_start_date, 'active', @signup_token)`
  ).run({
    id,
    employer_id,
    name: mapped.name,
    email: mapped.email,
    phone: mapped.phone,
    program_start_date,
    signup_token,
  });

  const { link, results } = await sendWelcomeLink({
    req,
    name: mapped.name,
    email: mapped.email,
    phone: mapped.phone,
    signupToken: signup_token,
  });

  db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, 'signup', ?)`).run(
    nanoid(),
    id,
    `Checkout completed via Remedora (funnel: ${mapped.funnel?.name || 'unknown'}), welcome message dispatched`
  );

  res.json({ member_id: id, employer_id, link, notifications: results, employer_signal: mapped.employerSignal });
});

module.exports = router;
