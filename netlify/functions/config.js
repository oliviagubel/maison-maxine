/* What the checkout page needs to draw Square's card form.

   The application id and location id are public by design (Square's card
   form runs in the customer's browser with them). The access token is never
   returned here or anywhere else. */

'use strict';
const { json, handler } = require('./_lib');
const { square } = require('./_square');

exports.handler = handler(async (body, origin) => {
  const s = square.settings();
  if (!s.present) return json(503, { error: 'checkout is not configured yet' }, origin);
  return json(200, {
    applicationId: s.applicationId,
    locationId: s.locationId,
    sandbox: s.sandbox,
  }, origin);
});
