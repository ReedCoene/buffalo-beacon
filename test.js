// Runnable self-check for the security + notify logic. No framework.
//   node test.js   (exits non-zero on failure)
const assert = require('node:assert');
const { mapsLink, isTokenUsable, statusChanged, buildTweet, tweetIntentUrl } = require('./lib/logic');

const future = new Date(Date.now() + 60000).toISOString();
const past = new Date(Date.now() - 60000).toISOString();

// --- isTokenUsable: the login security gate ---
assert.equal(isTokenUsable({ used: 0, expires_at: future }), true, 'fresh unused token should work');
assert.equal(isTokenUsable({ used: 1, expires_at: future }), false, 'used token must be rejected (no replay)');
assert.equal(isTokenUsable({ used: 0, expires_at: past }), false, 'expired token must be rejected');
assert.equal(isTokenUsable(null), false, 'unknown token must be rejected');

// --- statusChanged: don't spam subscribers on cosmetic edits ---
const org = { is_open: 0, hours_text: '9am-3pm' };
assert.equal(statusChanged(org, 1, '9am-3pm'), true, 'flipping open should notify');
assert.equal(statusChanged(org, 0, '10am-4pm'), true, 'changing hours should notify');
assert.equal(statusChanged(org, 0, '9am-3pm'), false, 'no status/hours change should NOT notify');

// --- mapsLink: address must be URL-encoded so directions actually work ---
assert.ok(
  mapsLink('1409 Main St, Buffalo, NY').includes('1409%20Main%20St%2C%20Buffalo%2C%20NY'),
  'address must be encoded'
);

// --- buildTweet / tweetIntentUrl: one-click share must carry the key facts ---
const tweetText = buildTweet(
  { name: 'Friends of Night People', is_open: 1, hours_text: 'Today 9am-3pm', address: '394 Hudson St', description: 'Hot food' },
  'http://localhost:3000'
);
assert.ok(tweetText.includes('OPEN NOW'), 'open status in tweet');
assert.ok(tweetText.includes('Today 9am-3pm'), 'hours in tweet');
assert.ok(tweetIntentUrl(tweetText).startsWith('https://twitter.com/intent/tweet?text='), 'valid intent url');

console.log('All checks passed.');
