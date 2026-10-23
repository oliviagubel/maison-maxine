/* Girls Night Giveaway: record one entry.

   Called by maisonmaxine.world/giveaway (cross-origin, POST, JSON). Entries
   are kept in Netlify Blobs, in the "girls-night-giveaway" store, keyed by
   email so each person counts once (the official rules allow one entry per
   person; a repeat keeps the first entry and is not an error).

   Export them as CSV with giveaway-export.js. */

'use strict';
const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');
const { json, handler } = require('./_lib');
const { sendLead } = require('./_meta');

const STORE = 'girls-night-giveaway';
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

exports.handler = handler(async (body, origin, event) => {
  // a hidden field people never see; bots fill it in
  if (clean(body.website, 100)) return json(200, { ok: true }, origin);

  // only plain text counts: a list, number or object is not an email
  if (typeof body.email !== 'string' || typeof body.firstName !== 'string') {
    return typeof body.email !== 'string'
      ? json(400, { error: 'enter a valid email', field: 'email' }, origin)
      : json(400, { error: 'first name is required', field: 'firstName' }, origin);
  }
  const firstName = clean(body.firstName, 60);
  const email = clean(body.email, 254).toLowerCase();
  const age21 = body.age21 === true;
  const optIn = body.optIn === true;

  if (!firstName) return json(400, { error: 'first name is required', field: 'firstName' }, origin);
  if (!EMAIL.test(email)) return json(400, { error: 'enter a valid email', field: 'email' }, origin);
  if (!age21) return json(400, { error: 'you must be 21 or older to enter', field: 'age21' }, origin);
  if (!optIn) return json(400, { error: 'please agree to receive maison maxine emails to enter', field: 'optIn' }, origin);

  connectLambda(event);
  const store = getStore(STORE);
  const key = crypto.createHash('sha256').update(email).digest('hex');

  const existing = await store.get(key, { type: 'json' });
  if (existing) return json(200, { ok: true, duplicate: true }, origin);

  await store.setJSON(key, {
    firstName,
    email,
    age21: true,
    optIn,
    enteredAt: new Date().toISOString(),
    utmSource: clean(body.utmSource, 100),
    utmCampaign: clean(body.utmCampaign, 100),
  });

  // tell meta from the server too (conversions api): it catches sign-ups the
  // browser pixel misses. same event id as the page's pixel Lead, so it's
  // counted once. only for new entries; a repeat isn't a new lead.
  const b = body.browser && typeof body.browser === 'object' ? body.browser : {};
  await sendLead({
    eventId: clean(body.eventId, 100),
    email, firstName, event,
    browser: { fbp: clean(b.fbp, 200), fbc: clean(b.fbc, 300), sourceUrl: clean(b.sourceUrl, 500), optOut: b.optOut === true },
  });
  return json(200, { ok: true }, origin);
});
