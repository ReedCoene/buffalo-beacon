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

module.exports = { mapsLink, isTokenUsable, statusChanged, buildTweet, tweetIntentUrl };
