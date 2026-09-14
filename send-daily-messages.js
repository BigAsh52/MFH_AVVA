// Sends today's Reset check-in message (see lib/dailyMessages.js) to every
// active member currently inside their 30-day Reset window, by email and/or
// SMS depending on which contact info + provider keys are configured.
//
// This is meant to run once a day. It's idempotent — each member gets at
// most one send per program day, tracked in `daily_message_log` — so it's
// safe if a cron double-fires or you re-run it manually.
//
// Wire it up with a real scheduler once this is deployed, e.g.:
//   - crontab:            0 8 * * * cd /path/to/app && node send-daily-messages.js
//   - a hosted cron (Render Cron Jobs, Railway Cron, etc.) pointed at the
//     same command, running once daily in each member's rough morning window
//
// Doesn't send anything to `engagements` — a message MedFit sent isn't a
// member action, and logging it there would distort the employer
// engagement-score/recency calculation (see lib/engagement.js).

require('dotenv').config();
const db = require('./db');
const { sendEmail, sendSms } = require('./lib/notify');
const { getDailyMessage, dayNumberFor } = require('./lib/dailyMessages');

async function run() {
  const members = db.prepare("SELECT * FROM members WHERE status = 'active'").all();
  let sent = 0;
  let skipped = 0;

  for (const member of members) {
    const day = dayNumberFor(member.program_start_date);
    if (day == null || day < 1 || day > 30) {
      skipped++;
      continue;
    }
    const entry = getDailyMessage(day);
    if (!entry) {
      skipped++;
      continue;
    }

    const dedupeKey = `${member.id}:${day}`;
    const already = db.prepare('SELECT id FROM daily_message_log WHERE id = ?').get(dedupeKey);
    if (already) {
      skipped++;
      continue;
    }

    const results = {};
    if (member.email) {
      results.email = await sendEmail({
        to: member.email,
        subject: `Day ${day} of your Reset`,
        text: entry.message,
        html: `<p>${entry.message}</p>`,
      });
    }
    if (member.phone) {
      results.sms = await sendSms({ to: member.phone, body: entry.message });
    }

    db.prepare('INSERT INTO daily_message_log (id, member_id, day) VALUES (?, ?, ?)').run(dedupeKey, member.id, day);
    console.log(`Day ${day} message sent to ${member.name} (${member.id})`, results);
    sent++;
  }

  console.log(`Done. Sent to ${sent} member(s), skipped ${skipped} (outside the 30-day window or already sent today).`);
}

run().catch((err) => {
  console.error('send-daily-messages failed:', err);
  process.exit(1);
});
