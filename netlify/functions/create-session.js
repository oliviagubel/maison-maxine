/* Create the Stripe Checkout session.

   The browser sends what it wants to buy and where to. It does NOT send the
   price: every figure is recomputed here from Vinoshipper, so a tampered page
   cannot buy a case for a dollar. Compliance is re-checked at the same time,
   so we never take money for an order Vinoshipper would reject.

   Everything needed to raise the order afterwards is packed into the session
   metadata, which is what lets the webhook work without a database. */

'use strict';
const { json, handler } = require('./_lib');
const { vs } = require('./_vs');
const { stripe, packMeta } = require('./_stripe');
const { priceOrder, minimumsMet, isOfAge, vsDiscount, FLAT_SHIPPING_CENTS } = require('./_pricing');

const SITE = 'https://maisonmaxine.world';
const money = cents => +(cents / 100).toFixed(2);

exports.handler = handler(async (body, origin) => {
  const { customer, shipToAddress, items, creatorCode } = body || {};

  if (!Array.isArray(items) || !items.length) return json(400, { error: 'no items' }, origin);
  if (!customer || !customer.email)           return json(400, { error: 'an email is needed' }, origin);
  if (!isOfAge(customer.dateOfBirth))         return json(403, { error: 'you must be 21 or older to order' }, origin);

  const min = minimumsMet(items);
  if (!min.ok) return json(400, { error: min.reason }, origin);

  const products = items.map(i => ({ productId: String(i.productId), quantity: i.quantity }));
  const base = { productIdType: 'VS_ID', products };

  let s;
  try { s = stripe(); }
  catch (e) { return json(503, { error: 'checkout is not configured yet' }, origin); }

  /* re-verify everything server side */
  let compliance, rate, taxesCents = 0, feesCents = 0;
  try {
    compliance = await vs.checkCompliance(Object.assign({ customer, shipToAddress }, base));
    if (compliance && compliance.isCompliant === false) {
      const problems = (compliance.problems || []).map(p => p.description || p.code).filter(Boolean);
      return json(200, { compliant: false, problems: problems.length ? problems : ['we cannot ship this order to that address'] }, origin);
    }

    const ship = await vs.estimateShipping(Object.assign({ shipToAddress, isResidential: true }, base));
    const rates = (ship && ship.rates) || [];
    rate = rates.find(r => /ground/i.test(r.rateDescription || r.description || '') && /ups/i.test(r.shippingClassCarrier || r.carrier || ''))
        || rates.find(r => /ground/i.test(r.rateDescription || r.description || ''))
        || rates[0];
    if (!rate) return json(200, { compliant: false, problems: ['we cannot ship to that address'] }, origin);

    const t = await vs.estimateTaxes(Object.assign({
      shipToAddress,
      shippingRate: { carrier: 'UPS', rateCode: rate.rateCode || rate.code, price: money(FLAT_SHIPPING_CENTS) },
    }, base));
    taxesCents = Math.round(((t && t.taxesTotal) || 0) * 100);
    feesCents  = Math.round(((t && t.extraFeesTotal) || 0) * 100);
  } catch (e) {
    if (e.configMissing) return json(503, { error: 'checkout is not configured yet' }, origin);
    console.error('[create-session] vinoshipper failed', e.status, JSON.stringify(e.data));
    return json(502, { error: 'we could not price that order' }, origin);
  }

  const p = priceOrder(items, creatorCode);

  const line_items = items.map(i => ({
    quantity: i.quantity,
    price_data: {
      currency: 'usd',
      unit_amount: i.unitPriceCents,
      product_data: { name: i.name || 'Maison Maxine' },
    },
  }));
  line_items.push({
    quantity: 1,
    price_data: { currency: 'usd', unit_amount: FLAT_SHIPPING_CENTS,
      product_data: { name: 'Shipping, UPS Ground' } },
  });
  if (taxesCents + feesCents > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency: 'usd', unit_amount: taxesCents + feesCents,
        product_data: { name: 'Taxes and state fees' } },
    });
  }

  const discounts = [];
  if (p.code && p.discountCents > 0) {
    const coupon = await s.coupons.create({
      amount_off: p.discountCents, currency: 'usd', duration: 'once', name: p.code,
    });
    discounts.push({ coupon: coupon.id });
  }

  /* what the webhook needs to raise the order, carried with the payment */
  const orderSeed = {
    customer, shipToAddress, products,
    rateCode: rate.rateCode || rate.code,
    taxes: money(taxesCents),
    fees: money(feesCents),
    discount: vsDiscount(items, creatorCode),
    creatorCode: p.code || '',
    carrierCost: rate.price != null ? rate.price : rate.amountChargedToCustomer,   // logged so the gap we absorb is visible
  };

  const session = await s.checkout.sessions.create({
    mode: 'payment',
    customer_email: customer.email,
    line_items,
    discounts,
    success_url: SITE + '/order-confirmed.html?session={CHECKOUT_SESSION_ID}',
    cancel_url: SITE + '/shop.html',
    metadata: packMeta(orderSeed, 'o'),
    payment_intent_data: { metadata: { site: 'maisonmaxine.world' } },
  });

  return json(200, { compliant: true, url: session.url, id: session.id }, origin);
});
