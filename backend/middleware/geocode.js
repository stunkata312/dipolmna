// Server-side address geocoder using OpenStreetMap Nominatim.
// Accepts any address worldwide. Returns { lat, lng } or null. Never throws.
//
// Strategy: try the full address, then progressively drop trailing tokens
// (postcodes, country suffixes, etc.) since Nominatim often fails on overly
// specific queries but succeeds on a slightly looser version.

async function tryQuery(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TakeASeat/1.0 (restaurant-reservation)' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const trimmed = address.trim();
  if (!trimmed) return null;

  // Build candidate queries: full → progressively drop trailing tokens.
  // Stop when ≤ 2 tokens remain so we don't degrade to just "China" or "Bulgaria".
  const tokens = trimmed.split(',').map(s => s.trim()).filter(Boolean);
  const candidates = [];
  candidates.push(tokens.join(', '));
  for (let n = tokens.length - 1; n >= 2; n--) {
    candidates.push(tokens.slice(0, n).join(', '));
  }
  const queries = [...new Set(candidates.filter(Boolean))].slice(0, 4);

  for (let i = 0; i < queries.length; i++) {
    const result = await tryQuery(queries[i]);
    if (result) return result;
    // Respect Nominatim's 1 req/sec rate limit between retries.
    if (i < queries.length - 1) await new Promise(r => setTimeout(r, 1100));
  }

  return null;
}

module.exports = { geocodeAddress };
