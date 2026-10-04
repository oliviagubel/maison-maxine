/* Health check for the checkout API.

   Proves three things before any real work depends on them:
     1. the function actually runs (the netlify catch-all isn't swallowing it)
     2. CORS from the shop origin works
     3. the Vinoshipper credentials are present in the environment

   It reports only WHETHER the credentials exist — never any part of their
   value. Safe to call from anywhere. */

'use strict';
const { json, handler, credentials } = require('./_lib');

exports.handler = handler(async (body, origin) => {
  const creds = credentials();
  return json(200, {
    ok: true,
    service: 'maison maxine checkout api',
    time: new Date().toISOString(),
    credentialsConfigured: creds.present,   // true/false only
    callerOrigin: origin || '(none)',
  }, origin);
});
