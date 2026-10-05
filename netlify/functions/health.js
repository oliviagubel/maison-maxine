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

exports.handler = handler(async (body, origin) => {
  const creds = credentials();

  /* "configured" only means the variables exist. That is not the same as them
     working, and the difference cost us a confusing 401, so actually try them
     against a harmless read. Only the outcome is reported, never a value. */
  let credentialsWork = null, upstream = null, lengths = null;
  if (creds.present) {
    try {
      await vs.wineList();
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

  return json(200, {
    ok: true,
    service: 'maison maxine checkout api',
    time: new Date().toISOString(),
    credentialsConfigured: creds.present,
    credentialsWork,
    upstream,
    lengths,
    stripeConfigured: Boolean((process.env.STRIPE_SECRET_KEY || '').trim()),
    webhookConfigured: Boolean((process.env.STRIPE_WEBHOOK_SECRET || '').trim()),
    callerOrigin: origin || '(none)',
  }, origin);
});
