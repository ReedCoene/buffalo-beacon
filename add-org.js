// Admin-only: adds an organization login. Not exposed as a public route on purpose —
// only vetted orgs (contacted through your teacher) should be able to post "we're open" info.
//
// Usage: node add-org.js "Org Name" "org-email@example.com"
const db = require('./db');

const [name, email] = process.argv.slice(2);

if (!name || !email) {
  console.error('Usage: node add-org.js "Org Name" "org-email@example.com"');
  process.exit(1);
}

const existing = db.prepare('SELECT * FROM organizations WHERE email = ?').get(email.trim().toLowerCase());
if (existing) {
  console.log(`Already exists: ${existing.name} <${existing.email}>`);
  process.exit(0);
}

db.prepare('INSERT INTO organizations (name, email) VALUES (?, ?)').run(name, email.trim().toLowerCase());
console.log(`Added "${name}" with login email ${email}. They can log in at /login once the server is running.`);
