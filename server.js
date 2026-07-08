require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const db = require('./db');
const { sendEmail } = require('./lib/mailer');
const { improveDescription } = require('./lib/claude');
const { mapsLink, isTokenUsable, statusChanged, buildTweet, tweetIntentUrl, timeAgo } = require('./lib/logic');
const { geocode } = require('./lib/geocode');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const TOKEN_TTL_MINUTES = 15;

// absolute paths so this runs correctly regardless of the process's cwd
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 },
}));

// one-shot flash message via query string — no extra dependency for something this small
app.use((req, res, next) => {
  res.locals.msg = req.query.msg || null;
  next();
});

// available in every view — freshness labels on listings
app.locals.timeAgo = timeAgo;

function requireOrg(req, res, next) {
  if (!req.session.orgId) return res.redirect('/login');
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.session.orgId);
  if (!org) {
    req.session.destroy(() => {});
    return res.redirect('/login');
  }
  req.org = org;
  next();
}

async function notifySubscribers(org) {
  const subs = db.prepare('SELECT * FROM subscribers WHERE org_id = ?').all(org.id);
  const status = org.is_open ? 'OPEN NOW' : 'now closed';
  const subject = `${org.name} is ${status}`;
  for (const sub of subs) {
    const text =
      `${org.name} just updated their status: ${status}.\n\n` +
      `Hours: ${org.hours_text || 'not listed'}\n` +
      `Address: ${org.address || 'not listed'}\n` +
      `Directions: ${mapsLink(org.address)}\n\n` +
      `${org.description || ''}\n\n` +
      `---\nStop these emails: ${BASE_URL}/unsubscribe/${sub.unsubscribe_token}`;
    await sendEmail(sub.email, subject, text);
  }
}

// ---- Public ----

app.get('/', (req, res) => {
  const orgs = db.prepare('SELECT * FROM organizations ORDER BY is_open DESC, name ASC').all();
  // Slim payload for the map — only orgs we have coordinates for get a pin.
  const pins = orgs
    .filter(o => o.lat != null && o.lng != null)
    .map(o => ({ name: o.name, lat: o.lat, lng: o.lng, isOpen: !!o.is_open, address: o.address }));

  // Community board — recent needs + updates across all orgs, needs first.
  const board = db.prepare(`
    SELECT p.*, o.name AS org_name, o.verified AS org_verified
    FROM posts p JOIN organizations o ON o.id = p.org_id
    ORDER BY (p.kind = 'need') DESC, p.created_at DESC
    LIMIT 20
  `).all();

  res.render('index', { orgs, mapsLink, pins, board });
});

app.post('/subscribe/:orgId', (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.orgId);
  const email = (req.body.email || '').trim().toLowerCase();
  if (!org || !email) return res.redirect('/?msg=' + encodeURIComponent('Something went wrong — try again.'));

  const token = crypto.randomBytes(16).toString('hex');
  try {
    db.prepare(
      'INSERT INTO subscribers (org_id, email, unsubscribe_token) VALUES (?, ?, ?)'
    ).run(org.id, email, token);
  } catch (e) {
    // already subscribed — ignore, not an error from the user's point of view
  }
  res.redirect('/?msg=' + encodeURIComponent(`You're subscribed to updates from ${org.name}.`));
});

app.get('/unsubscribe/:token', (req, res) => {
  db.prepare('DELETE FROM subscribers WHERE unsubscribe_token = ?').run(req.params.token);
  res.render('unsubscribed');
});

// ---- Org login (magic link, admin-provisioned accounts only) ----

app.get('/login', (req, res) => {
  res.render('login', { sent: false });
});

app.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const org = db.prepare('SELECT * FROM organizations WHERE email = ?').get(email);

  if (org) {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO magic_tokens (org_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(org.id, token, expiresAt);

    const link = `${BASE_URL}/auth/${token}`;
    await sendEmail(
      org.email,
      'Your 716 Beacon login link',
      `Click to log in to ${org.name}'s 716 Beacon dashboard (expires in ${TOKEN_TTL_MINUTES} minutes):\n\n${link}`
    );
  }

  // Same message whether or not the email matched — don't reveal which emails have accounts.
  res.render('login', { sent: true });
});

app.get('/auth/:token', (req, res) => {
  const row = db.prepare('SELECT * FROM magic_tokens WHERE token = ?').get(req.params.token);

  if (!isTokenUsable(row)) {
    return res.redirect('/login?msg=' + encodeURIComponent('That login link is invalid or expired. Request a new one.'));
  }

  db.prepare('UPDATE magic_tokens SET used = 1 WHERE id = ?').run(row.id);
  req.session.orgId = row.org_id;
  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---- Org dashboard ----

function orgPosts(orgId) {
  return db.prepare('SELECT * FROM posts WHERE org_id = ? ORDER BY created_at DESC').all(orgId);
}

app.get('/dashboard', requireOrg, (req, res) => {
  res.render('dashboard', { org: req.org, posts: orgPosts(req.org.id) });
});

app.post('/dashboard/post', requireOrg, (req, res) => {
  const kind = req.body.kind === 'need' ? 'need' : 'update';
  const body = (req.body.body || '').trim();
  if (body) {
    db.prepare('INSERT INTO posts (org_id, kind, body) VALUES (?, ?, ?)').run(req.org.id, kind, body);
  }
  res.redirect('/dashboard');
});

app.post('/dashboard/post/:id/delete', requireOrg, (req, res) => {
  // Scope delete to this org so one org can't delete another's posts.
  db.prepare('DELETE FROM posts WHERE id = ? AND org_id = ?').run(req.params.id, req.org.id);
  res.redirect('/dashboard');
});

app.post('/dashboard/improve', requireOrg, async (req, res) => {
  const improved = await improveDescription(req.body.text || '');
  res.json({ improved });
});

app.post('/dashboard/update', requireOrg, async (req, res) => {
  const name = (req.body.name || '').trim();
  const address = (req.body.address || '').trim();
  const hoursText = (req.body.hours_text || '').trim();
  const description = (req.body.description || '').trim();
  const isOpen = req.body.is_open === 'on' ? 1 : 0;

  if (!name || !address || !hoursText) {
    return res.render('dashboard', {
      org: { ...req.org, name, address, hours_text: hoursText, description, is_open: isOpen },
      posts: orgPosts(req.org.id),
      error: 'Name, address, and hours are required.',
    });
  }

  const shouldNotify = statusChanged(req.org, isOpen, hoursText);

  // Only re-geocode when the address actually changed (avoids a needless network call on every save).
  let { lat, lng } = req.org;
  if (address !== req.org.address) {
    const coords = await geocode(address);
    lat = coords ? coords.lat : null;
    lng = coords ? coords.lng : null;
  }

  db.prepare(
    `UPDATE organizations
     SET name = ?, address = ?, hours_text = ?, description = ?, is_open = ?, lat = ?, lng = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(name, address, hoursText, description, isOpen, lat, lng, req.org.id);

  const updatedOrg = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.org.id);

  if (shouldNotify) {
    await notifySubscribers(updatedOrg);
  }

  const tweetUrl = tweetIntentUrl(buildTweet(updatedOrg, BASE_URL));
  res.render('dashboard', { org: updatedOrg, saved: true, notified: shouldNotify, tweetUrl, posts: orgPosts(req.org.id) });
});

app.listen(PORT, () => {
  console.log(`716 Beacon running at ${BASE_URL}`);
});
