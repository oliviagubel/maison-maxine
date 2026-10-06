/* Price a basket for an address, entirely server side.

   Used by both /quote (show the customer a total) and /pay (charge that
   total). Sharing one function is what keeps the number on screen and the
   number charged identical.

   Nothing from the browser is trusted for money: unit prices come from the
   Vinoshipper product feed, keyed by product id, and anything not in the
   feed is refused. The browser only says what it wants and where to. */

'use strict';
const { vs } = require('./_vs');
const { priceOrder, minimumsMet, isOfAge, vsDiscount, FLAT_SHIPPING_CENTS } = require('./_pricing');

const money = cents => +(cents / 100).toFixed(2);

/* vinoshipper product id -> how the creator-code rules treat it */
const KINDS = {
  '185926': 'fourpack',   // Red Wine Spritz, gift box of 4
  '200144': 'case',       // 24 pack
};

function fail(status, body) { return { ok: false, status, body }; }

async function priceBasket({ customer, shipToAddress, items, creatorCode }) {
  if (!Array.isArray(items) || !items.length) return fail(400, { error: 'no items' });
  if (!shipToAddress || !shipToAddress.stateCode || !shipToAddress.postalCode) {
    return fail(400, { error: 'a shipping state and postal code are needed' });
  }
  if (!isOfAge(customer && customer.dateOfBirth)) {
    return fail(403, { error: 'you must be 21 or older to order' });
  }

  /* ── 0. real prices from vinoshipper ───────────────────────────── */
  let feed;
  try { feed = await vs.wineList(); }
  catch (e) {
    if (e.configMissing) return fail(503, { error: 'checkout is not configured yet' });
    console.error('[basket] product feed failed', e.status, JSON.stringify(e.data));
    return fail(502, { error: 'we could not load prices', upstream: e.status || null, step: 'prices' });
  }
  const byId = {};
  for (const p of (feed && feed.products) || []) byId[String(p.id)] = p;

  const lineItems = [];
  for (const i of items) {
    const id = String(i.productId);
    const p = byId[id];
    const qty = parseInt(i.quantity, 10);
    if (!p || !KINDS[id]) return fail(400, { error: 'that product is not available' });
    if (!(qty > 0 && qty <= 72)) return fail(400, { error: 'please check the quantity' });
    lineItems.push({
      productId: id,
      name: p.displayName || p.name,
      quantity: qty,
      unitPriceCents: Math.round(Number(p.price) * 100),
      kind: KINDS[id],
    });
  }

  const min = minimumsMet(lineItems);
  if (!min.ok) return fail(400, { error: min.reason });

  const products = lineItems.map(li => ({ productId: li.productId, quantity: li.quantity }));
  const base = { productIdType: 'VS_ID', products };

  /* ── 1. compliance first: never price, or charge, a rejected order ── */
  let compliance;
  try {
    compliance = await vs.checkCompliance(Object.assign({ customer, shipToAddress }, base));
  } catch (e) {
    console.error('[basket] compliance failed', e.status, JSON.stringify(e.data));
    return fail(502, { error: 'we could not check shipping rules for that address', upstream: e.status || null, step: 'compliance' });
  }
  if (compliance && compliance.isCompliant === false) {
    const problems = (compliance.problems || []).map(p => p.description || p.code).filter(Boolean);
    return fail(200, { compliant: false, problems: problems.length ? problems : ['we cannot ship this order to that address'] });
  }

  /* ── 2. shipping: UPS Ground, keep the rate code for the order ────── */
  let rate = null;
  try {
    const ship = await vs.estimateShipping(Object.assign({ shipToAddress, isResidential: true }, base));
    const rates = (ship && ship.rates) || [];
    rate = rates.find(r => /ground/i.test(r.rateDescription || r.description || '') && /ups/i.test(r.shippingClassCarrier || r.carrier || ''))
        || rates.find(r => /ground/i.test(r.rateDescription || r.description || ''))
        || rates[0] || null;
  } catch (e) {
    console.error('[basket] shipping failed', e.status, JSON.stringify(e.data));
    return fail(502, { error: 'we could not work out shipping for that address', upstream: e.status || null, step: 'shipping' });
  }
  if (!rate) return fail(200, { compliant: false, problems: ['we cannot ship to that address'] });
  const rateCode = rate.rateCode || rate.code;

  /* ── 3. taxes and state fees ───────────────────────────────────── */
  let taxesCents = 0, feesCents = 0;
  try {
    const t = await vs.estimateTaxes(Object.assign({
      shipToAddress,
      shippingRate: { carrier: 'UPS', rateCode, price: money(FLAT_SHIPPING_CENTS) },
    }, base));
    taxesCents = Math.round(((t && t.taxesTotal) || 0) * 100);
    feesCents  = Math.round(((t && t.extraFeesTotal) || 0) * 100);
  } catch (e) {
    console.error('[basket] taxes failed', e.status, JSON.stringify(e.data));
    return fail(502, { error: 'we could not work out tax for that address', upstream: e.status || null, step: 'taxes' });
  }

  const p = priceOrder(lineItems, creatorCode);
  const totalCents = p.subtotalCents - p.discountCents + p.shippingCents + taxesCents + feesCents;

  return {
    ok: true,
    lineItems,
    products,
    rateCode,
    carrierCost: rate.price != null ? rate.price : rate.amountChargedToCustomer,
    creatorCode: p.code,
    discount: vsDiscount(lineItems, creatorCode),
    cents: {
      subtotal: p.subtotalCents,
      discount: p.discountCents,
      shipping: p.shippingCents,
      taxes: taxesCents,
      fees: feesCents,
      total: totalCents,
    },
  };
}

module.exports = { priceBasket, money };
