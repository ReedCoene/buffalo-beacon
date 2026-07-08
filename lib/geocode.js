// Turn a street address into { lat, lng } using OpenStreetMap's free Nominatim service.
// No API key. Returns null on any failure so a bad address never blocks a save —
// the org's card still works, it just won't get a map pin until the address geocodes.
//
// ponytail: no caching/rate-limiter — orgs geocode once on save, volume is tiny.
// Nominatim asks for <1 req/sec and a real User-Agent; both fine at this scale.
async function geocode(address) {
  const q = (address || '').trim();
  if (!q) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': '716Beacon/1.0 (community shelter directory)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (e) {
    console.error('Geocode failed for', q, '-', e.message);
    return null;
  }
}

module.exports = { geocode };
