/* Price a basket for a given address: compliance first, then shipping, then
   taxes. Nothing here charges anyone. The pricing itself lives in _basket.js,
   shared with /pay so the quoted total and the charged total cannot differ. */

'use strict';
const { json, handler } = require('./_lib');
const { priceBasket } = require('./_basket');

exports.handler = handler(async (body, origin) => {
  const b = await priceBasket(body || {});
  if (!b.ok) return json(b.status, b.body, origin);

  return json(200, {
    compliant: true,
    creatorCode: b.creatorCode,     // null if the code was not valid
    rateCode: b.rateCode,
    carrierCost: b.carrierCost,     // what UPS costs us; we charge $7 and absorb the gap
    cents: b.cents,
  }, origin);
});
