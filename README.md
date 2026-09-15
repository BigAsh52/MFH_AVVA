# Avva — by MedFit

A working prototype: member-facing lifestyle coaching app ("Avva") + employer
engagement console, triggered off a real Remedora checkout webhook. Everything
in this repo runs — real backend, real database, real screens — not a mockup.

## What's real right now

- **Real Remedora webhook integration** (`POST /api/checkout/webhook`): verifies
  Remedora's HMAC-SHA256 signature (`X-Remedora-Signature`,
  `X-Remedora-Timestamp`), de-duplicates retried deliveries via
  `X-Remedora-Delivery`, only acts on `checkout_completed` events (anything
  else is acknowledged and ignored), and requires `meta.includes_medical_data`
  so it actually has patient contact info to work with. On a valid delivery it
  creates a member record, generates a one-time signup link, and dispatches a
  welcome email/text. See `lib/remedora.js` and the "Open question" section
  below — **this needs your input.**
- Baseline intake ("Get Started") screen: the first time a member opens the
  app, they enter gender, age, height, starting weight/body fat/muscle
  mass/waist/resting heart rate, activity level, dietary preferences, a goal
  weight, **and an initial full-body photo**. This is what powers BMI and lets
  progress be measured from a real starting point, both for the member and in
  the employer rollup.
- **Progress photos** (baseline + monthly): stored in `progress_photos`, a
  table and storage directory (`private_uploads/`) that are structurally
  separate from anything the employer console touches — see "Photo privacy"
  below.
- Member app: home dashboard (including BMI), AI coach chat, meal/workout/
  vitals logging, progress charts + photo gallery, and a "Trusted resources"
  card — all backed by a real SQLite database.
- Employer console: aggregate KPIs (participation, avg. weight/body-fat/BMI
  change, workouts logged), weekly engagement + group-average-BMI trend
  charts, and a sortable roster with click-through drill-down (weight + BMI
  charts, food-logging grid, full engagement timeline) to any one participant.
  Never shows a photo or a link to one.
- **Engagement score + coaching triage** on the employer console: each member
  gets a 0-100 engagement score and a Green/Yellow/Red ("Engaged" / "Needs a
  nudge" / "Disengaged") attention flag, computed from food-logging density,
  weigh-in cadence, workout logging, and recency (see `lib/engagement.js` for
  the exact formula — it's original and fully documented there, and the
  weights are easy to tune once real usage data comes in). The dashboard adds
  a "Coaching insights" panel with programmatically generated "what I notice"
  observations and a "next best actions" outreach list, sorted by who needs
  attention most.
- **30-day Reset check-in messages**: an original day-by-day message series
  (`lib/dailyMessages.js`) tied to each member's `program_start_date`. Shows
  up as a "Day N of your Reset" card on the member app's home screen (with a
  one-tap action — log today's weight, or ask the coach something specific),
  and can be pushed out by email/SMS via `node send-daily-messages.js` — see
  "Daily check-in messages" below for how to wire that to a real scheduler.
- Every member action (chat question, meal logged, workout logged, vitals
  logged, baseline intake, photo logged) writes to an `engagements` table,
  which is what the employer dashboard and drill-down are built on — a photo
  shows up there only as a generic "logged a photo" entry, same as a meal.
- A curated library of reputable external recipe/workout resources (Mayo
  Clinic, Cleveland Clinic, Harvard Health, Fatty Liver Foundation, ACE
  Fitness) — see the "Recipes and workouts" section below for why.
- MedFit brand color (`#0092CA`, extracted from the MedFit Health logo) applied
  as the primary color token across both the member app and employer console,
  in both light and dark mode.
- **Staff admin panel** (`/admin/`) with real individual staff logins (not the
  member signup link): create/edit employer groups, tag any member as
  belonging to a specific employer group or to a pooled **Direct Consumers**
  group (self-pay members with no employer sponsor, reviewed the same way an
  employer's roster is, internally only), manually invite someone by email/
  text without waiting on a Remedora checkout, resend a lost link, and add
  more staff accounts. The employer console (`/employer/`) now requires this
  same staff login too — it used to be reachable by anyone with the URL.
- **Avva is installable** ("Add to Home Screen") on both iPhone and Android —
  real app icon (`public/member/icons/`), manifest, and a service worker. See
  "Getting Avva onto a phone" below for what that means since it isn't an App
  Store / Play Store app.
- **A public "Get the App" page** (`/get-app.html`) for linking from
  medfit.health — explains the install, and lets an existing member re-request
  their personal app link by email/phone if they lost it.
- **Coach answers beyond the built-in knowledge base**: for anything outside
  the scripted grocery/shake/dinner/workout topics, the coach searches a
  curated allowlist of trusted clinical sources first (Mayo Clinic, Cleveland
  Clinic, Harvard Health, Johns Hopkins, NIH, CDC, MedlinePlus, ACE Fitness)
  and only falls back to the open web if that turns up nothing — see
  `lib/webKnowledge.js`.

## Open question: employer attribution in Remedora's webhook

I read the real Remedora webhook documentation you sent (docx). Its
`checkout_completed` payload has **no field for which employer sponsors a
given member's benefit** — the closest thing, `organization`, is Remedora's
account holder (i.e., MedFit itself), not the employer paying for that
member's program.

Right now `resolveEmployerSignal()` in `lib/remedora.js` does its best with
what's there: it looks for an intake question that reads like "employer /
sponsor / company / benefit" and uses its answer if found, and otherwise falls
back to the checkout funnel's name (e.g. "Acme Manufacturing GLP-1 Benefit"),
flagging the employer record with a note that it was auto-created from a
funnel-name guess. **This is a stopgap, not a confirmed-correct mapping** — I
need to know from you how employer attribution actually works in your real
Remedora setup: is there a specific intake question you always ask, a
per-employer funnel/landing page, a custom field, or something else? Once I
know, I can make this exact instead of best-effort.

## What's simulated until you plug in your own accounts

| Piece | Right now | Goes live when you add |
|---|---|---|
| AI coach chat | Scripted answers for grocery lists, shake/dinner recipes, restaurant guidance | `ANTHROPIC_API_KEY` in `.env` |
| Restaurant/menu live lookups, and any question outside the built-in topics | Coach reasons from general knowledge (or, with only `SERPER_API_KEY` and no `ANTHROPIC_API_KEY`, returns raw trusted-source/web links without a conversational answer) | `SERPER_API_KEY` (or swap in another search API in `lib/webKnowledge.js`) |
| Welcome email | Logged to `notifications.log`, link still generated and returned by the API | `SENDGRID_API_KEY` |
| Welcome text | Logged to `notifications.log` | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` |
| Checkout webhook signature | Accepted unverified, with a console warning (dev mode) | `REMEDORA_SIGNING_SECRET` (from Remedora's dashboard) |

Copy `.env.example` to `.env` and fill in whichever of these you have — nothing
else needs to change in the code.

## Running it

```
npm install
npm run seed     # loads 9 demo participants with 8 weeks of history + demo photos
npm start         # http://localhost:3210
```

- Member app: `/app/?demo=<member_id>` (the seed script prints a sample id),
  or the real flow via `/app/welcome.html?t=<signup_token>`
- Employer console: `/employer/?employer=demo-employer` (requires staff login)
- Staff admin: `/admin/` (requires staff login)
- Get the app (public): `/get-app.html`

`npm run seed` also creates a demo staff login so `/admin/` and `/employer/`
work immediately: **demo@medfit.health / avva-demo-2026**. For a real
deployment, create your own first account instead —
`node create-admin.js "Your Name" you@medfit.health "a strong password"` —
and, once you're logged in, add teammates from the Admin panel's Staff tab
rather than the command line.

**Important once this holds real staff accounts / real members**: stop
running `seed.js` on every boot (it wipes and regenerates all employers and
members every time it runs). That's a demo-only convenience — see the note in
the "Hosting" section of the project doc / your deploy notes.

Test the webhook locally with a correctly signed request:

```
node -e "
const crypto = require('crypto');
const secret = 'whatever-you-set-REMEDORA_SIGNING_SECRET-to';
const body = JSON.stringify({ event: 'checkout_completed', meta: { delivery_id: 'evt_1', includes_medical_data: true }, data: { patient: { name: 'Test Person', email: 'test@example.com' } } });
const ts = Math.floor(Date.now()/1000).toString();
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(ts + '.' + body).digest('hex');
console.log(ts, sig, body);
"
# then curl -X POST with X-Remedora-Event/Delivery/Timestamp/Signature headers and that body
```

## Daily check-in messages

`lib/dailyMessages.js` holds an original 30-entry message series — one per
day of a member's Reset, keyed off `program_start_date`. Some days just carry
encouragement; others carry a one-tap action: log today's weight, or a
specific thing to ask the coach (worded to line up with what the scripted/
live coach actually recognizes — grocery list, shake, dinner, restaurant,
snack, resistant-starch foods).

Two ways this reaches a member:
1. **In the app**: the home screen shows a "Day N of your Reset" card
   automatically (`GET /api/members/:id/daily-message`) — no scheduler
   needed, since it just reflects today's date against their own start date.
2. **By email/SMS**: run `node send-daily-messages.js` (or
   `npm run send-daily-messages`) once a day. It's idempotent — each member
   gets at most one send per program day (tracked in `daily_message_log`, a
   table kept deliberately separate from `engagements` so an automated
   message never counts as the member's own engagement or inflates their
   score). Wire it to a real scheduler once this is deployed:
   ```
   # crontab -e
   0 8 * * * cd /path/to/app && node send-daily-messages.js
   ```
   or point a hosted cron (Render Cron Jobs, Railway Cron, etc.) at the same
   command, running once a day.

## Engagement score & coaching insights

`lib/engagement.js` computes a 0-100 engagement score per member (food
logging density 55%, weigh-in cadence 20%, workout logging 15%, a recency
bonus/penalty up to ±20 depending on how long since they last logged
anything), banded into Green ("Engaged", ≥70) / Yellow ("Needs a nudge",
40-69) / Red ("Disengaged", <40) — with a "New" label for members still in
their first 3 days with nothing logged yet, so a brand-new signup doesn't
read as red. This is an original scoring model, not copied from any
third-party tool — the weights are documented in the file and easy to retune
once you have real usage data to check them against.

The employer dashboard's "Coaching insights" panel is generated fresh from
each dashboard load — a couple of "what I notice" observations (e.g. how many
members haven't weighed in recently) and a "next best actions" list of
whoever most needs outreach, with a plain-language reason. Nothing here is
hardcoded copy; all of it comes straight from that dashboard's own data.

## Staff admin — accounts, employer groups & direct consumers

`/admin/` is staff-only (real login, `admin_users` table, session cookie
backed by a `sessions` table so it survives a restart — see `lib/auth.js`).
It's also the login for `/employer/`, which used to have no auth at all.

- **Employer groups**: create/rename groups, see member counts, jump to any
  group's console.
- **Direct Consumers**: a single pooled group (`employers.is_direct_consumer`)
  for self-pay members with no employer sponsor. They get the same
  engagement-console treatment as a real employer's roster, but it's reviewed
  internally by MedFit staff only — a direct consumer never sees this
  dashboard themselves.
- **Members**: search everyone across every group, reassign anyone to a
  different group (or to Direct Consumers) with one dropdown — this is also
  how you fix a Remedora signup that guessed the wrong employer (see "Open
  question" above), resend a lost signup link, or manually invite someone by
  email/text who isn't coming through a Remedora checkout at all (a phone
  signup, a walk-in, a direct consumer).
- **Staff**: add more staff accounts once you're logged in — no shell access
  needed after the first one.

Not in this build yet: roles/permissions (every staff account can do
everything above), and rate-limiting on the login endpoint — worth adding
before this is handling a real staff roster at scale.

## Getting Avva onto a phone (PWA, no App Store)

Avva is a web app, not a native iOS/Android app, so there's nothing to
publish to the App Store or Google Play. What it *can* do — and now does — is
install like one: `public/member/manifest.json` + real icons
(`public/member/icons/`, a placeholder monogram in MedFit blue — swap in a
real logo mark whenever you have one) + a service worker
(`public/member/sw.js`) mean a member can add it to their Home Screen on
either iPhone or Android and get a proper full-screen app icon, no browser
chrome, indistinguishable at a glance from a native app.

Two ways someone gets there:
1. **Their personal link** (from the Remedora welcome email/text, or a staff
   manual invite) — opening it in Safari/Chrome and adding it to their Home
   Screen is the real flow.
2. **`/get-app.html`** — a public page for linking from medfit.health.
   Explains the install, and has a "lost my link" form
   (`POST /api/members/resend-link`) that re-sends an existing member's link
   by email or phone without revealing whether that email/phone is enrolled
   either way.

`public/member/pwa-install.js` shows a small in-app banner prompting the
install on first visit (Android fires a real `beforeinstallprompt`; iOS
Safari never does, so it gets static "tap Share → Add to Home Screen"
instructions instead) — dismissible, and it won't nag again for two weeks.

## Photo privacy — a hard boundary, by design

James asked for an initial full-body photo at onboarding and monthly progress
photos after that, **never shared with the employer**. This is enforced
architecturally, not just by convention:

- Photos live in their own table (`progress_photos`) and their own storage
  directory (`private_uploads/progress_photos/`), which sits **outside**
  `public/` — Express's static file server never serves it.
- `routes/photos.js` is the only code that reads or writes that table/
  directory, and every photo request is scoped to the member who owns it.
- `routes/employer.js` carries a comment at the top of the file stating this
  boundary explicitly, so it's the first thing a future contributor sees
  before adding a new employer-facing field.
- The only trace an employer ever sees is a generic engagement entry ("logged
  a photo"), identical in shape to a logged meal or workout — never the image,
  never a link to it.

## Content note — please read

I reviewed both "Liver Cleanse Quick Start Guide.pdf" (MedFit's own document)
and "Metabolism Reset Diet.pdf" (the full commercially published book by Alan
Christianson, NMD, copyright 2019) to build this.

`lib/framework.js` reuses the **functional/factual program parameters** —
things also stated in MedFit's own guide, which MedFit wrote and owns: the
elimination list (alcohol, added sugar, processed food, caffeine, dairy), the
shake macro targets (23g+ protein, 20g+ resistant starch), the food
categories used to build shakes and dinners, and the light-exercise-only
guidance during the reset.

It does **not** reuse the book's actual recipe write-ups, its specific
week-by-week menu pairings, or its specific shopping-list line items — that's
the book's protected creative content, and MedFit's own guide explicitly
tells readers to buy the book for "grocery lists, recipes, and other tips and
tricks," which reads as MedFit not currently holding redistribution rights to
that material. Every recipe and weekly grocery list in this file is original,
written to hit the same functional targets from scratch.

If MedFit secures redistribution rights from the publisher, the book's real
recipes/menus could replace these placeholders directly (they'd slot into
the same `GROCERY_LISTS` / `SHAKE_RECIPES` / `DINNER_RECIPES` structures).

## Recipes and workout plans — external resources, not invented content

Per James's direction: rather than the coach inventing full recipes or
workout programs, `lib/resources.js` holds a small curated library of
reputable, publicly available sources (Mayo Clinic Diet, Cleveland Clinic,
Harvard Health, the Fatty Liver Foundation, and ACE Fitness), found via web
search on 2026-09-10. The scripted (no-API-key) coach mode links to these
directly; the system prompt in `lib/framework.js` instructs the live
Claude-API mode to do the same — use `web_search` to find a good current
source for a full recipe collection or multi-week workout program rather
than writing one from scratch, and only sketch a quick one-off example (like
"a shake built from X + Y + Z") in the moment.

Worth a periodic check that the curated links still resolve and that the
linked content hasn't materially changed, and worth expanding the list in
`lib/resources.js` as MedFit's team finds other sources worth trusting.

## Brand

The primary color (`#0092CA`) was extracted directly from the MedFit Health
logo (pixel-sampled from the logo mark in the Liver Cleanse guide PDF, since
medfit.health itself wasn't reachable from this environment). It's applied as
the `--primary` / `--primary-deep` / `--primary-tint` CSS custom properties in
both `public/member/style.css` and `public/employer/style.css`, for both light
and dark mode. This covers the primary brand blue only — if MedFit has a
fuller brand guide (secondary colors, an official type system, logo files),
send it over and I'll match it exactly rather than working from one extracted
color.

## What's not in this build (real gaps, not code problems)

- **Member-side auth**: a member's access is still just their one-time
  signup-token link (by design — it's a low-friction enrollment flow), not a
  password/session. Staff-side auth (`/admin/`, `/employer/`) is real now —
  see "Staff admin" above. If a member's link setup ever needs to be more
  than that (e.g. a returning member on a new device), it'll need its own
  proper login.
- **Admin roles/permissions**: every staff account can do everything in
  `/admin/` — no "read-only" or "employer-scoped" staff role yet.
- **Automated food-photo → calories/macros**: the meal photo upload is stored
  as a note; automatic nutrition estimation from a photo needs a vision/
  nutrition API (e.g. a food-recognition service) wired into
  `routes/engagement.js`.
- **HIPAA-aware hosting**: SQLite-on-disk is fine for a prototype; a real
  deployment handling PHI under a BAA needs a hosted Postgres with encryption
  at rest, audit logging, and a hosting provider willing to sign a BAA (e.g.
  AWS/GCP with their standard BAA, not a generic PaaS free tier). This applies
  doubly to progress photos.
- **A real domain**: right now this runs on localhost / whatever host you
  deploy it to. Pointing `app.medfit.health` at it is a DNS step on your end.

## Project layout

```
server.js              Express app, route mounting, staff-auth gating, raw-body capture for webhook signatures
db.js                  SQLite schema (+ the Direct Consumers bucket bootstrap)
create-admin.js         One-time CLI bootstrap for the first staff account
routes/checkout.js      Remedora webhook -> member creation + welcome send
routes/members.js       Member profile/summary + public resend-link
routes/engagement.js    Meal / workout / vitals logging
routes/coach.js         AI coach chat endpoint + resource library
routes/employer.js      Aggregate dashboard + per-member drill-down (never touches photos) — staff-only
routes/admin.js         Staff login + employer groups + cross-employer member roster/invite/reassign
routes/photos.js        Private progress-photo upload/serving
lib/auth.js              Staff password hashing + DB-backed sessions + auth middleware
lib/welcome.js           Shared "send the app link" — used by checkout.js and admin.js
lib/notify.js            Email/SMS senders (simulate when keys are absent)
lib/coachEngine.js       Claude API integration + scripted fallback
lib/webKnowledge.js      Trusted-allowlist-first / open-web-fallback external Q&A search
lib/framework.js         Original diet/recipe program content (see Content note)
lib/resources.js         Curated external recipe/workout sources
lib/remedora.js          Webhook signature verification + payload mapping
lib/health.js            BMI calculation
lib/engagement.js        Engagement score + coaching-insights generation
lib/dailyMessages.js     30-day Reset check-in message series
public/member/          Member-facing web app "Avva" (mobile-first) + manifest/icons/service worker
public/employer/        Employer engagement console (staff-only)
public/admin/           Staff admin panel + shared staff login page
public/site/get-app.html Public "get the app" / lost-link page, for linking from medfit.health
seed.js                 Demo data generator (participants, demo photos, demo staff login)
send-daily-messages.js  Daily check-in email/SMS sender (run via cron)
```
