// ponytail: Node's built-in sqlite (stable since Node 22.5) instead of better-sqlite3 —
// same API shape, no native compilation, no node-gyp/Python toolchain needed.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'beacon.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    address TEXT DEFAULT '',
    hours_text TEXT DEFAULT '',
    description TEXT DEFAULT '',
    is_open INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS magic_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    email TEXT NOT NULL,
    unsubscribe_token TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, email)
  );
`);

// Community board: orgs post "needs" (volunteers/donations) or "updates" (events/announcements).
// This is the year-round content that keeps people following between storms.
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id),
    kind TEXT NOT NULL DEFAULT 'update',  -- 'need' or 'update'
    body TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations (ALTER has no IF NOT EXISTS in sqlite, so guard on PRAGMA).
const cols = db.prepare("PRAGMA table_info(organizations)").all().map(c => c.name);
if (!cols.includes('lat')) db.exec('ALTER TABLE organizations ADD COLUMN lat REAL');
if (!cols.includes('lng')) db.exec('ALTER TABLE organizations ADD COLUMN lng REAL');
// Every org is admin-vetted before it's added, so all existing orgs are verified by definition.
// ponytail: default 1; flip to 0 only if you ever open self-signup and need a review queue.
if (!cols.includes('verified')) db.exec('ALTER TABLE organizations ADD COLUMN verified INTEGER NOT NULL DEFAULT 1');

module.exports = db;
