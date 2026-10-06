/* Address search for the checkout's "address" field, via Google Places (New).

   Two calls, one session (google bills a typed search plus the pick as one):
     { q, session }        -> up to five US suggestions to show under the field
     { placeId, session }  -> that place broken into street, city, state, zip

   The key is GOOGLE_PLACES_KEY in netlify's env and never leaves the server.
   With no key set this answers 503 and the page simply shows no dropdown, so
   typing the address by hand (and phone autofill) keep working regardless. */

'use strict';
const { json, handler } = require('./_lib');

const BASE = 'https://places.googleapis.com/v1';

function key() { return (process.env.GOOGLE_PLACES_KEY || '').trim(); }

async function suggest(q, session) {
  const res = await fetch(BASE + '/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key() },
    body: JSON.stringify({ input: q, includedRegionCodes: ['us'], sessionToken: session || undefined }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error('autocomplete'); e.status = res.status; e.data = d; throw e; }
  return (d.suggestions || [])
    .map(s => s.placePrediction)
    .filter(Boolean)
    .slice(0, 5)
    .map(p => ({
      placeId: p.placeId,
      main: (p.structuredFormat && p.structuredFormat.mainText && p.structuredFormat.mainText.text) || (p.text && p.text.text) || '',
      rest: (p.structuredFormat && p.structuredFormat.secondaryText && p.structuredFormat.secondaryText.text) || '',
    }));
}

async function details(placeId, session) {
  const url = BASE + '/places/' + encodeURIComponent(placeId) + (session ? '?sessionToken=' + encodeURIComponent(session) : '');
  const res = await fetch(url, { headers: { 'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': 'addressComponents' } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error('details'); e.status = res.status; e.data = d; throw e; }

  const parts = d.addressComponents || [];
  const get = (type, short) => {
    const c = parts.find(p => (p.types || []).includes(type));
    return c ? (short ? c.shortText : c.longText) : '';
  };
  const number = get('street_number'), route = get('route', true);
  return {
    street1: [number, route].filter(Boolean).join(' '),
    street2: get('subpremise') ? '#' + get('subpremise') : '',
    city: get('locality') || get('postal_town') || get('sublocality') || get('neighborhood') || get('administrative_area_level_3'),
    state: get('administrative_area_level_1', true),
    zip: get('postal_code'),
    country: get('country', true),
    hasNumber: Boolean(number),
  };
}

exports.handler = handler(async (body, origin) => {
  if (!key()) return json(503, { error: 'address search is not configured' }, origin);
  const session = typeof body.session === 'string' ? body.session.slice(0, 64) : '';

  try {
    if (typeof body.placeId === 'string' && body.placeId) {
      return json(200, { address: await details(body.placeId.slice(0, 300), session) }, origin);
    }
    const q = typeof body.q === 'string' ? body.q.trim().slice(0, 120) : '';
    if (q.length < 3) return json(200, { suggestions: [] }, origin);
    return json(200, { suggestions: await suggest(q, session) }, origin);
  } catch (e) {
    console.error('[address] google failed', e.status, JSON.stringify(e.data));
    return json(502, { error: 'address search failed' }, origin);
  }
});
