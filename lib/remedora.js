// Integration helpers for Remedora's checkout webhook, per
// "Remedora WebHook Documentation.docx" (reviewed 2026-09-10).
//
// Delivery basics (from the docs):
// - POST, application/json. Respond 2xx to acknowledge.
// - Headers: X-Remedora-Event, X-Remedora-Delivery, X-Remedora-Timestamp,
//   X-Remedora-Signature ("sha256=<hex digest>").
// - Signature: HMAC_SHA256(signing_secret, `${timestamp}.${rawBody}`),
//   constant-time compare.
// - Retries up to 4x (60s/300s/900s backoff) on non-2xx; meta.delivery_id
//   is stable across retries, so de-dupe on it.
//
// Open question for MedFit (not answered by the docs): Remedora's payload
// has no employer/sponsor field at all — "organization" is Remedora's term
// for the account that owns the funnel (e.g. MedFit itself), not the
// employer sponsoring an individual member's benefit. resolveEmployer()
// below does its best (a matching intake question, else the funnel name),
// but this needs a real answer from however Remedora is actually configured
// for MedFit's employer book of business — see README.

const crypto = require('crypto');

function verifySignature({ rawBody, timestamp, signatureHeader, signingSecret }) {
  if (!signingSecret) return { ok: false, reason: 'no REMEDORA_SIGNING_SECRET configured' };
  if (!signatureHeader || !timestamp || !rawBody) return { ok: false, reason: 'missing signature, timestamp, or body' };

  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return { ok: false, reason: 'signature length mismatch' };
  return { ok: crypto.timingSafeEqual(a, b), reason: null };
}

// Best-effort employer resolution. Checks intake answers for a
// question that looks like it's asking about an employer/sponsor, then
// falls back to the funnel name, then null (an unattributed / direct
// signup, e.g. someone who paid for MedFit's program on their own).
function resolveEmployerSignal(data) {
  const intake = data.intake || [];
  const employerQuestion = intake.find((q) => /employ|sponsor|company|benefit/i.test(q.question || q.step_key || ''));
  if (employerQuestion?.answer) return { name: employerQuestion.answer, source: 'intake' };

  if (data.funnel?.name) return { name: data.funnel.name, source: 'funnel_fallback' };

  return null;
}

function mapCheckoutCompleted(data) {
  const patient = data.patient || {};
  return {
    remedoraPatientId: patient.id ?? null,
    name: patient.name || null,
    email: patient.email || null,
    phone: patient.phone || null,
    funnel: data.funnel || null,
    payment: data.payment || null,
    employerSignal: resolveEmployerSignal(data),
  };
}

module.exports = { verifySignature, mapCheckoutCompleted, resolveEmployerSignal };
