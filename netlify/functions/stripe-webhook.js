/* Stripe webhook: the ONLY place a Vinoshipper order is created.

   Fires on checkout.session.completed, so an order can only exist after the
   money is captured. The order goes in with `paid: true`, which is what tells
   Vinoshipper to bill us rather than charge the customer.

   Idempotency without a database: once the order is raised, its Vinoshipper
   number is written onto the Stripe PaymentIntent. Stripe retries webhooks,
   so without this a retry would raise a second order for one payment. The
   check is read-before-write against that same field. */

'use strict';
const { stripe, unpackMeta } = require('./_stripe');
const { vs } = require('./_vs');

// signature verification needs the raw body, so this handler is deliberately
// not wrapped in the CORS helper the browser endpoints use
exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    console.error('[webhook] missing signature or STRIPE_WEBHOOK_SECRET');
    return { statusCode: 400, body: 'bad request' };
  }

  let s, evt;
  try {
    s = stripe();
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    evt = s.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error('[webhook] signature verification failed:', e.message);
    return { statusCode: 400, body: 'invalid signature' };
  }

  if (evt.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'ignored' };
  }

  const session = evt.data.object;
  if (session.payment_status !== 'paid') {
    console.warn('[webhook] session', session.id, 'not paid:', session.payment_status);
    return { statusCode: 200, body: 'not paid' };
  }

  const seed = unpackMeta(session.metadata || {}, 'o');
  if (!seed) {
    console.error('[webhook] no order payload on session', session.id);
    return { statusCode: 200, body: 'no payload' };   // 200, so stripe stops retrying
  }

  /* ── idempotency ─────────────────────────────────────────────── */
  const piId = typeof session.payment_intent === 'string'
    ? session.payment_intent : (session.payment_intent && session.payment_intent.id);
  if (piId) {
    try {
      const pi = await s.paymentIntents.retrieve(piId);
      if (pi.metadata && pi.metadata.vsOrderNumber) {
        console.log('[webhook] session', session.id, 'already raised order', pi.metadata.vsOrderNumber);
        return { statusCode: 200, body: 'already created' };
      }
    } catch (e) {
      console.error('[webhook] could not read payment intent', piId, e.message);
    }
  }

  const order = {
    orderNumber: 'MM-' + session.id.slice(-18),
    sourceUrl: 'https://maisonmaxine.world',
    customer: seed.customer,
    shipToAddress: seed.shipToAddress,
    productIdType: 'VS_ID',
    products: seed.products,
    shippingRate: { carrier: 'UPS', rateCode: seed.rateCode, price: 7.00 },
    taxes: seed.taxes,
    fees: seed.fees,
    tipAmount: 0,
    discount: seed.discount || null,
    metaFields: {
      stripeSessionId: session.id,
      creatorCode: seed.creatorCode || '',
    },
    disableCustomerNotifications: false,
    paid: true,
  };

  let created;
  try {
    created = await vs.createOrder(order);
  } catch (e) {
    // the money is already taken, so this needs a human, not a blind retry
    console.error('[webhook] ORDER FAILED for paid session', session.id,
                  'status', e.status, 'detail', JSON.stringify(e.data));
    return { statusCode: 200, body: 'order failed, logged' };
  }

  const vsNumber = (created && (created.orderNumber || created.id)) || 'unknown';
  console.log('[webhook] raised vinoshipper order', vsNumber,
              'for session', session.id,
              '| we charged $7 shipping, carrier cost', seed.carrierCost);

  if (piId) {
    try {
      await s.paymentIntents.update(piId, { metadata: { vsOrderNumber: String(vsNumber) } });
    } catch (e) {
      console.error('[webhook] could not stamp order number on', piId, e.message);
    }
  }

  return { statusCode: 200, body: 'ok' };
};
