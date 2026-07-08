// Seeds the two real Buffalo orgs mentioned by name so the directory has real, recognizable
// entries for a demo. Login emails here are placeholders until the real contact is confirmed —
// swap them with `node add-org.js` once your teacher connects you, or edit directly in the DB.
const db = require('./db');

const orgs = [
  {
    name: 'Friends of Night People',
    // ponytail: using your own email so you can personally test the full login → dashboard →
    // AI-improve → notify-subscribers loop before handing real accounts to real orgs.
    email: 'friends@placeholder.buffalobeacon.local',
  },
  {
    name: "Luke's Mission of Mercy",
    email: 'lukesmission@placeholder.buffalobeacon.local',
  },
];

for (const org of orgs) {
  const existing = db.prepare('SELECT * FROM organizations WHERE email = ?').get(org.email);
  if (existing) {
    console.log(`Already seeded: ${org.name}`);
    continue;
  }
  db.prepare('INSERT INTO organizations (name, email) VALUES (?, ?)').run(org.name, org.email);
  console.log(`Seeded: ${org.name} <${org.email}>`);
}

console.log('\nDone. Run "npm start" then visit http://localhost:3000');
