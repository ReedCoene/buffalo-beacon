// Admin-only: removes an organization and everything tied to it (subscribers,
// magic tokens, board posts). Complement to add-org.js.
//
// Usage: node remove-org.js org-email@example.com
const db = require('./db');

const [email] = process.argv.slice(2);

if (!email) {
  console.error('Usage: node remove-org.js org-email@example.com');
  process.exit(1);
}

const org = db.prepare('SELECT * FROM organizations WHERE email = ?').get(email.trim().toLowerCase());
if (!org) {
  console.log(`No organization with email ${email}`);
  process.exit(0);
}

db.prepare('DELETE FROM subscribers WHERE org_id = ?').run(org.id);
db.prepare('DELETE FROM magic_tokens WHERE org_id = ?').run(org.id);
db.prepare('DELETE FROM posts WHERE org_id = ?').run(org.id);
db.prepare('DELETE FROM organizations WHERE id = ?').run(org.id);
console.log(`Removed "${org.name}" <${org.email}> and all related data.`);
