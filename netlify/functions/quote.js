/* Price a basket for a given address: compliance first, then shipping, then
   taxes. Nothing here charges anyone.

   Compliance runs FIRST and a failure returns early, so we never quote, and
   never take payment for, an order Vinoshipper would reject. */

'use strict';
const { json, handler } = require('./_lib');
const { vs } = require('./_vs');
const { priceOrder, minimumsMet, isOfAge, FLAT_SHIPPING_CENTS } = require('./_pricing');

const money = cents => +(cents / 100).toFixed(2);

exports.handler = handler(async (body, origin) => {
  const { customer, shipToAddress, items, creatorCode } = body || {};

  if (!Array.isArray(items) || !items.length) {
    return json(400, { error: 'no items' }, origin);
  }
  if (!shipToAddress || !shipToAddress.stateCode || !shipToAddress.postalCode) {
    return json(400, { error: 'a shipping state and postal code are needed' }, origin);
  }

  const min = minimumsMet(items);
  if (!min.ok) return json(400, { error: min.reason }, origin);

  if (!isOfAge(customer && customer.dateOfBirth)) {
    return json(403, { error: 'you must be 21 or older to order' }, origin);
  }

  const products = items.map(i => ({ productId: String(i.productId), quantity: i.quantity }));
  const base = { productIdType: 'VS_ID', products };

  /* ── 1. compliance ─────────────────────────────────────────────── */
  let compliance;
  try {
    compliance = await vs.checkCompliance(Object.assign({ customer, shipToAddress }, base));
  } catch (e) {
    if (e.configMissing) return json(503, { error: 'checkout is not configured yet' }, origin);
    console.error('[quote] compliance failed', e.status, JSON.stringify(e.data));
    return json(502, { error: 'we could not check shipping rules for that address', upstream: e.status || null, step: 'compliance' }, origin);
  }

  if (compliance && compliance.isCompliant === false) {
    const problems = (compliance.problems || []).map(p => p.description || p.code).filter(Boolean);
    return json(200, {
      compliant: false,
      problems: problems.length ? problems : ['we cannot ship this order to that address'],
    }, origin);
  }

  /* ── 2. shipping — UPS Ground, and keep the rate code for the order ── */
  let rate = null;
  try {
    const ship = await vs.estimateShipping(Object.assign({
      shipToAddress, isResidential: true,
    }, base));
    const rates = (ship && ship.rates) || [];
    rate = rates.find(r => /ground/i.test(r.rateDescription || r.description || '') && /ups/i.test(r.shippingClassCarrier || r.carrier || ''))
        || rates.find(r => /ground/i.test(r.rateDescription || r.description || ''))
        || rates[0] || null;
  } catch (e) {
    console.error('[quote] shipping failed', e.status, JSON.stringify(e.data));
    return json(502, { error: 'we could not work out shipping for that address', upstream: e.status || null, step: 'shipping' }, origin);
  }
  if (!rate) return json(200, { compliant: false, problems: ['we cannot ship to that address'] }, origin);

  /* ── 3. taxes and fees ─────────────────────────────────────────── */
  let taxesTotal = 0, feesTotal = 0;
  try {
    const t = await vs.estimateTaxes(Object.assign({
      shipToAddress,
      shippingRate: { carrier: 'UPS', rateCode: rate.rateCode || rate.code, price: money(FLAT_SHIPPING_CENTS) },
    }, base));
    taxesTotal = Math.round(((t && t.taxesTotal) || 0) * 100);
    feesTotal  = Math.round(((t && t.extraFeesTotal) || 0) * 100);
  } catch (e) {
    console.error('[quote] taxes failed', e.status, JSON.stringify(e.data));
    return json(502, { error: 'we could not work out tax for that address', upstream: e.status || null, step: 'taxes' }, origin);
  }

  const p = priceOrder(items, creatorCode);
  const total = p.subtotalCents - p.discountCents + p.shippingCents + taxesTotal + feesTotal;

  return json(200, {
    compliant: true,
    creatorCode: p.code,                       // null if the code was not valid
    rateCode: rate.rateCode || rate.code,                       // carried into the order
    carrierCost: rate.price != null ? rate.price : rate.amountChargedToCustomer, // what vinoshipper would charge; we absorb the gap
    cents: {
      subtotal: p.subtotalCents,
      discount: p.discountCents,
      shipping: p.shippingCents,
      taxes: taxesTotal,
      fees: feesTotal,
      total,
    },
  }, origin);
});
