const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { nanoid } = require('nanoid');
const db = require('../db');

const router = express.Router();

// Progress photos are private to the member. This directory sits OUTSIDE
// public/, so express.static never serves it — the only way to fetch a
// photo's bytes is the gated route below. Nothing in routes/employer.js
// (the employer-facing API) touches this table or this directory: an
// employer can see that a member logged a photo (a generic "photo" entry in
// the engagement timeline, same as a meal or workout), never the photo
// itself.
const STORAGE_ROOT = path.join(__dirname, '..', 'private_uploads', 'progress_photos');
fs.mkdirSync(STORAGE_ROOT, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(STORAGE_ROOT, req.body.member_id || 'unknown');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = (file.mimetype.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '');
      cb(null, `${Date.now()}-${nanoid(8)}.${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
});

router.post('/', upload.single('photo'), (req, res) => {
  const { member_id, photo_type, taken_on } = req.body;
  if (!member_id || !req.file) return res.status(400).json({ error: 'member_id and photo are required' });
  if (!['baseline', 'monthly'].includes(photo_type)) {
    return res.status(400).json({ error: "photo_type must be 'baseline' or 'monthly'" });
  }

  const member = db.prepare('SELECT id FROM members WHERE id = ?').get(member_id);
  if (!member) return res.status(404).json({ error: 'member not found' });

  const id = nanoid();
  db.prepare(
    `INSERT INTO progress_photos (id, member_id, photo_type, taken_on, file_path, mime_type)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, member_id, photo_type, taken_on || new Date().toISOString().slice(0, 10), req.file.path, req.file.mimetype);

  db.prepare(`INSERT INTO engagements (id, member_id, type, summary) VALUES (?, ?, 'photo', ?)`).run(
    nanoid(),
    member_id,
    photo_type === 'baseline' ? 'Logged baseline photo' : 'Logged monthly progress photo'
  );

  res.json({ id });
});

// List a member's own photos (member-scoped — see file-boundary note above).
router.get('/:memberId', (req, res) => {
  const rows = db
    .prepare('SELECT id, photo_type, taken_on, created_at FROM progress_photos WHERE member_id = ? ORDER BY taken_on ASC')
    .all(req.params.memberId);
  res.json(rows.map((r) => ({ ...r, url: `/api/photos/file/${r.id}?member_id=${req.params.memberId}` })));
});

// Serve the actual image bytes. Gated on the caller knowing the member_id —
// the same weak-auth model as the rest of this prototype (see README: no
// real session/auth yet). Never mounted anywhere near the employer routes.
router.get('/file/:id', (req, res) => {
  const photo = db.prepare('SELECT * FROM progress_photos WHERE id = ?').get(req.params.id);
  if (!photo || photo.member_id !== req.query.member_id) return res.status(404).end();
  res.type(photo.mime_type || 'image/jpeg');
  fs.createReadStream(photo.file_path).pipe(res);
});

module.exports = router;
