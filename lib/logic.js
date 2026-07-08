// Pure helpers with no DB/HTTP deps so they can be unit-tested directly.

function mapsLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;
}

// A magic-login token is only usable if it exists, hasn't been used, and hasn't expired.
// This is the security gate on org login — get it wrong and expired/replayed links let people in.
function isTokenUsable(row, now = new Date()) {
  if (!row) return false;
  if (row.used) return false;
  if (new Date(row.expires_at) < now) return false;
  return true;
}

// Only notify subscribers when something they'd care about changed: open/closed flipped,
// or the hours changed. Editing the description alone shouldn't spam everyone's inbox.
function statusChanged(oldOrg, newIsOpen, newHours) {
  return newIsOpen !== oldOrg.is_open || newHours !== oldOrg.hours_text;
}

// Draft a ready-to-post tweet for the org's current status. They click once to post
// from their own account — no paid X API, no auto-posting, org keeps control.
function buildTweet(org, siteUrl) {
  const status = org.is_open ? '🟢 OPEN NOW' : '⚪ Now closed';
  const name = org.verified ? `${org.name} ✓` : org.name;
  const parts = [`${name} — ${status}`];
  if (org.hours_text) parts.push(`Hours: ${org.hours_text}`);
  if (org.address) parts.push(`📍 ${org.address}`);
  if (org.is_open && org.description) parts.push(org.description);
  parts.push(`More: ${siteUrl}`);
  parts.push('#Buffalo #BuffaloBeacon');
  return parts.join('\n');
}

function tweetIntentUrl(text) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

// Freshness label ("2 hrs ago") shown next to every status — in a storm, how CURRENT
// a listing is matters as much as what it says. SQLite CURRENT_TIMESTAMP stores UTC
// as "YYYY-MM-DD HH:MM:SS" with no zone marker, so we must tag it as UTC ourselves
// or engines parse it as local time and the label is hours off.
function timeAgo(sqliteUtc, now = new Date()) {
  if (!sqliteUtc) return '';
  const raw = String(sqliteUtc);
  const iso = raw.includes('Z') || raw.includes('+') ? raw : raw.replace(' ', 'T') + 'Z';
  const then = new Date(iso);
  if (isNaN(then)) return '';
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

module.exports = { mapsLink, isTokenUsable, statusChanged, buildTweet, tweetIntentUrl, timeAgo };
