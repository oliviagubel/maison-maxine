/* Products and the states we may ship to.

   Prices come from Vinoshipper rather than being hard-coded here, so a price
   change in the dashboard reaches the shop without a deploy. `shipsTo` drives
   the state dropdown at the address step. */

'use strict';
const { json, handler } = require('./_lib');
const { vs } = require('./_vs');

exports.handler = handler(async (body, origin) => {
  try {
    const list = await vs.wineList();
    return json(200, {
      shipsTo: list.shipsTo || [],
      wines: (list.wines || []).map(w => ({
        id: w.id, name: w.name, sku: w.sku, price: w.price,
      })),
    }, origin);
  } catch (e) {
    if (e.configMissing) return json(503, { error: 'checkout is not configured yet' }, origin);
    console.error('[catalog] failed', e.status, JSON.stringify(e.data));
    return json(502, { error: 'could not load the catalogue' }, origin);
  }
});
