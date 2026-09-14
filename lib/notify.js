// Email + SMS delivery.
// Real send happens automatically the moment the corresponding env vars are
// set (see .env.example). Until then, every "send" is logged to
// notifications.log and returned in the API response so the flow is fully
// testable without a live SendGrid/Twilio account.

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', 'notifications.log');

function logNotification(entry) {
  const line = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
  fs.appendFileSync(LOG_PATH, line);
}

async function sendEmail({ to, subject, html, text }) {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL || 'welcome@medfit.health';

  if (!key) {
    logNotification({ channel: 'email', mode: 'SIMULATED', to, subject, text });
    return { sent: false, simulated: true, channel: 'email' };
  }

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: 'MedFit' },
      subject,
      content: [
        { type: 'text/plain', value: text || '' },
        { type: 'text/html', value: html || `<p>${text || ''}</p>` },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    logNotification({ channel: 'email', mode: 'FAILED', to, subject, error: body });
    return { sent: false, simulated: false, channel: 'email', error: body };
  }

  logNotification({ channel: 'email', mode: 'SENT', to, subject });
  return { sent: true, simulated: false, channel: 'email' };
}

async function sendSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    logNotification({ channel: 'sms', mode: 'SIMULATED', to, body });
    return { sent: false, simulated: true, channel: 'sms' };
  }

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    logNotification({ channel: 'sms', mode: 'FAILED', to, body, error: errBody });
    return { sent: false, simulated: false, channel: 'sms', error: errBody };
  }

  logNotification({ channel: 'sms', mode: 'SENT', to, body });
  return { sent: true, simulated: false, channel: 'sms' };
}

module.exports = { sendEmail, sendSms };
