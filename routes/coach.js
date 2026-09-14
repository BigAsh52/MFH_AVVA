const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { getCoachReply } = require('../lib/coachEngine');
const { RESOURCE_LIBRARY } = require('../lib/resources');

const router = express.Router();

router.get('/resources', (req, res) => {
  res.json(RESOURCE_LIBRARY);
});

router.get('/history/:memberId', (req, res) => {
  const rows = db
    .prepare('SELECT role, content, created_at FROM chat_messages WHERE member_id = ? ORDER BY created_at ASC LIMIT 100')
    .all(req.params.memberId);
  res.json(rows);
});

router.post('/chat', async (req, res) => {
  const { member_id, message } = req.body;
  if (!member_id || !message) return res.status(400).json({ error: 'member_id and message are required' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(member_id);
  if (!member) return res.status(404).json({ error: 'member not found' });

  const weekNumber = Math.max(
    1,
    Math.ceil((Date.now() - new Date(member.program_start_date).getTime()) / (7 * 24 * 3600 * 1000))
  );

  db.prepare(`INSERT INTO chat_messages (id, member_id, role, content) VALUES (?, ?, 'user', ?)`).run(
    nanoid(),
    member_id,
    message
  );

  const history = db
    .prepare('SELECT role, content FROM chat_messages WHERE member_id = ? ORDER BY created_at ASC LIMIT 20')
    .all(member_id);

  const { reply, live, fallbackReason } = await getCoachReply({ message, history, memberWeekNumber: weekNumber });

  db.prepare(`INSERT INTO chat_messages (id, member_id, role, content) VALUES (?, ?, 'assistant', ?)`).run(
    nanoid(),
    member_id,
    reply
  );

  db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, 'chat', ?)`).run(
    nanoid(),
    member_id,
    `Asked coach: "${message.slice(0, 80)}"`
  );

  res.json({ reply, live, fallbackReason });
});

module.exports = router;
