/* Take payment with Square, then raise the paid order in Vinoshipper.

   The browser sends a one-time card token from Square's card form (never a
   card number), what it wants to buy, where to, and the total it showed the
   customer. Everything is re-priced here; if the total has moved since the
   quote, nothing is charged and the page asks the customer to look again.

   Order of operations, and why:
     1. price + compliance        never charge for an order that would be refused
     2. charge the card (Square)  an order only exists once money is captured
     3. create the order (VS)     paid: true, so Vinoshipper does not charge again
     4. if 3 fails, refund 2      the customer is never charged for nothing

   Retries: the page sends the same idempotency key for the same attempt, so a
   double click or a dropped connection cannot charge twice (Square returns the
   original payment) or order twice (we look the order number up first). */

'use strict';
const crypto = require('crypto');
const { json, handler } = require('./_lib');
const { vs } = require('./_vs');
const { square, declineMessage } = require('./_square');
const { priceBasket, money } = require('./_basket');

exports.handler = handler(async (body, origin) => {
  const { customer, shipToAddress, items, creatorCode, sourceId, verificationToken,
          idempotencyKey, expectedTotalCents } = body || {};

  if (!sourceId)                       return json(400, { error: 'card details are missing' }, origin);
  if (!idempotencyKey || String(idempotencyKey).length > 45) {
    return json(400, { error: 'please refresh the page and try again' }, origin);
  }
  if (!customer || !/\S+@\S+\.\S+/.test(customer.email || '')) {
    return json(400, { error: 'an email is needed' }, origin);
  }

  const sq = square.settings();
  if (!sq.present) return json(503, { error: 'checkout is not configured yet' }, origin);

  /* ── 1. price and compliance, from scratch ───────────────────────── */
  const b = await priceBasket({ customer, shipToAddress, items, creatorCode });
  if (!b.ok) return json(b.status, b.body, origin);

  if (Number(expectedTotalCents) !== b.cents.total) {
    return json(409, {
      error: 'the total changed while you were checking out. please review it and pay again.',
      cents: b.cents,
    }, origin);
  }

  /* ── 2. charge ───────────────────────────────────────────────────── */
  let payment;
  try {
    const r = await square.createPayment({
      idempotency_key: String(idempotencyKey),
      source_id: String(sourceId),
      verification_token: verificationToken || undefined,
      amount_money: { amount: b.cents.total, currency: 'USD' },
      location_id: sq.locationId,
      autocomplete: true,
      buyer_email_address: customer.email,
      reference_id: 'maisonmaxine.world',
      note: 'Maison Maxine web order: ' +
            b.lineItems.map(li => li.quantity + ' x ' + li.name).join(', ') +
            (b.creatorCode ? ' (code ' + b.creatorCode + ')' : ''),
    });
    payment = r && r.payment;
  } catch (e) {
    if (e.status && e.status < 500 && e.code) {
      console.warn('[pay] card not accepted:', e.code);
      return json(402, { error: declineMessage(e.code) }, origin);
    }
    console.error('[pay] square failed', e.status, JSON.stringify(e.data));
    return json(502, { error: 'we could not reach the payment processor. you have not been charged.' }, origin);
  }

  if (!payment || payment.status !== 'COMPLETED') {
    console.error('[pay] payment not completed', payment && payment.id, payment && payment.status);
    return json(402, { error: 'that payment did not go through. you have not been charged.' }, origin);
  }

  /* ── 3. raise the order ─────────────────────────────────────────── */
  const orderNumber = 'MM-' + payment.id.slice(-18);

  // a retry of the same attempt: the order may already exist
  try {
    const existing = await vs.getOrder(orderNumber);
    if (existing) return json(200, { ok: true, orderNumber }, origin);
  } catch (e) {
    if (e.status !== 404 && e.status !== 400) {
      console.warn('[pay] order lookup', orderNumber, 'returned', e.status);
    }
  }

  const order = {
    orderNumber,
    sourceUrl: 'https://maisonmaxine.world',
    customer,
    shipToAddress,
    productIdType: 'VS_ID',
    products: b.products,
    shippingRate: { carrier: 'UPS', rateCode: b.rateCode, price: money(b.cents.shipping) },
    taxes: money(b.cents.taxes),
    fees: money(b.cents.fees),
    tipAmount: 0,
    discount: b.discount || null,
    metaFields: {
      squarePaymentId: payment.id,
      creatorCode: b.creatorCode || '',
    },
    disableCustomerNotifications: false,
    paid: true,
  };

  try {
    await vs.createOrder(order);
  } catch (e) {
    console.error('[pay] ORDER FAILED after payment', payment.id,
                  'status', e.status, 'detail', JSON.stringify(e.data));

    /* ── 4. give the money back ────────────────────────────────────── */
    try {
      await square.refundPayment({
        idempotency_key: 'refund-' + crypto.createHash('sha256').update(payment.id).digest('hex').slice(0, 30),
        payment_id: payment.id,
        amount_money: { amount: b.cents.total, currency: 'USD' },
        reason: 'order could not be placed with the shipper',
      });
      console.log('[pay] refunded', payment.id);
      return json(502, {
        error: 'we could not place your order, so your payment has been refunded. please email olivia@maisonmaxine.world and we will sort it out.',
      }, origin);
    } catch (re) {
      // money taken, no order, no refund: this one needs a person today
      console.error('[pay] REFUND FAILED, needs manual refund', payment.id, re.status, JSON.stringify(re.data));
      return json(502, {
        error: 'your payment went through but we could not place the order. please email olivia@maisonmaxine.world with reference ' +
               payment.id.slice(-12) + ' and we will fix it right away.',
      }, origin);
    }
  }

  console.log('[pay] order', orderNumber, 'paid', payment.id, money(b.cents.total),
              '| charged shipping', money(b.cents.shipping), '| carrier cost', b.carrierCost);

  return json(200, { ok: true, orderNumber }, origin);
});
