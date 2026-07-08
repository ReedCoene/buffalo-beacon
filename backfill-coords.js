// One-off: geocode any org that has an address but no map coordinates yet.
//   node backfill-coords.js
const db = require('./db');
const { geocode } = require('./lib/geocode');

(async () => {
  const rows = db.prepare(
    "SELECT * FROM organizations WHERE address <> '' AND (lat IS NULL OR lng IS NULL)"
  ).all();

  if (!rows.length) {
    console.log('Nothing to backfill — all orgs with an address already have coordinates.');
    return;
  }

  for (const org of rows) {
    const coords = await geocode(org.address);
    if (coords) {
      db.prepare('UPDATE organizations SET lat = ?, lng = ? WHERE id = ?').run(coords.lat, coords.lng, org.id);
      console.log(`Pinned ${org.name} -> ${coords.lat}, ${coords.lng}`);
    } else {
      console.log(`Could not geocode ${org.name} ("${org.address}")`);
    }
    await new Promise(r => setTimeout(r, 1100)); // Nominatim: stay under 1 req/sec
  }
  console.log('Done.');
})();
