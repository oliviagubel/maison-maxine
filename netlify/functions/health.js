/* Health check for the checkout API.

   Proves three things before any real work depends on them:
     1. the function actually runs (the netlify catch-all isn't swallowing it)
     2. CORS from the shop origin works
     3. the Vinoshipper credentials are present in the environment

   It reports only WHETHER the credentials exist — never any part of their
   value. Safe to call from anywhere. */

'use strict';
const { json, handler, credentials } = require('./_lib');
const { vs } = require('./_vs');
const { square } = require('./_square');

exports.handler = handler(async (body, origin) => {
  const creds = credentials();

  /* "configured" only means the variables exist. That is not the same as them
     working, and the difference cost us a confusing 401, so actually try them
     against a harmless read. Only the outcome is reported, never a value. */
  let credentialsWork = null, upstream = null, lengths = null;
  if (creds.present) {
    try {
      await vs.activeShippers();
      credentialsWork = true;
    } catch (e) {
      credentialsWork = false;
      upstream = e.status || null;
      // lengths help spot a truncated paste without revealing anything
      lengths = {
        key: (process.env.VINOSHIPPER_API_KEY || '').trim().length,
        secret: (process.env.VINOSHIPPER_API_SECRET || '').trim().length,
      };
    }
  }

  /* square: the token works AND the location id belongs to that account */
  const sq = square.settings();
  let squareWorks = null, squareUpstream = null, squareLocationFound = null;
  if (sq.present) {
    try {
      const r = await square.locations();
      squareWorks = true;
      squareLocationFound = ((r && r.locations) || []).some(l => l.id === sq.locationId);
    } catch (e) {
      squareWorks = false;
      squareUpstream = e.status || null;
    }
  }

  return json(200, {
    ok: true,
    service: 'maison maxine checkout api',
    time: new Date().toISOString(),
    credentialsConfigured: creds.present,
    credentialsWork,
    upstream,
    lengths,
    squareConfigured: sq.present,
    squareMode: sq.present ? (sq.sandbox ? 'sandbox' : 'production') : null,
    squareWorks,
    squareUpstream,
    squareLocationFound,
    callerOrigin: origin || '(none)',
  }, origin);
});
