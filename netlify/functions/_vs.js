/* Vinoshipper REST client — server side only.

   The key and secret are read from the environment and used for HTTP Basic
   auth. They are never returned to the caller, never logged, and never
   included in an error message that reaches the browser.

   Vinoshipper takes no card details from us. `paid: true` on an order means
   we captured the funds ourselves (Square), and Vinoshipper collects the tax
   and fees it calculated from the producer account instead. That is why
   payment happens before the order is created, never the other way round. */

'use strict';

const BASE = 'https://vinoshipper.com';
const PRODUCER_ID = 5982; // maison maxine's vinoshipper account

function auth() {
  // trim: a trailing newline or stray space from pasting into the dashboard is
  // invisible in the ui and produces a 401 that looks like a wrong key
  const key = (process.env.VINOSHIPPER_API_KEY || '').trim();
  const secret = (process.env.VINOSHIPPER_API_SECRET || '').trim();
  if (!key || !secret) {
    const e = new Error('vinoshipper credentials are not configured');
    e.configMissing = true;
    throw e;
  }
  return 'Basic ' + Buffer.from(key + ':' + secret).toString('base64');
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: auth(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }

  if (!res.ok) {
    // keep the detail server-side; callers decide what is safe to surface
    const e = new Error('vinoshipper ' + method + ' ' + path + ' -> ' + res.status);
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

const vs = {
  /* catalogue + the states we may ship to. /api/v3/wine-list no longer
     exists (it answers 400 for any caller); the producer feed is the current
     source and returns { producer, products, states }. */
  wineList:        ()     => call('GET',  '/api/v3/feeds/vs/' + PRODUCER_ID + '/products'),
  /* authenticated read with no side effects: proves the key and secret work */
  activeShippers:  ()     => call('GET',  '/api/v3/p/shippers/active'),
  estimateShipping:(body) => call('POST', '/api/v3/p/orders/estimate-shipping', body),
  estimateTaxes:   (body) => call('POST', '/api/v3/p/orders/estimate-taxes', body),
  checkCompliance: (body) => call('POST', '/api/v3/p/orders/check-compliance', body),
  createOrder:     (body) => call('POST', '/api/v3/p/orders', body),
  getOrder:        (num)  => call('GET',  '/api/v3/p/orders/' + encodeURIComponent(num)),
};

module.exports = { vs, BASE };
