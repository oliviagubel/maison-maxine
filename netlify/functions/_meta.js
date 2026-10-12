/* Meta Conversions API: the server's copy of the Purchase event.

   The browser Pixel misses sales (Instagram's in-app browser, iOS, ad
   blockers), so /pay also tells Meta about every paid order from here. Both
   copies carry the same event_id (the order number), so Meta counts the sale
   once and marks the pair deduplicated.

   Environment (Netlify, never in page code):
     META_CAPI_TOKEN        access token from Events Manager > Settings >
                            Conversions API. With none set, nothing is sent.
     META_PIXEL_ID          optional; defaults to the site's pixel
     META_TEST_EVENT_CODE   optional; while set, events land in Events
                            Manager > Test events. Remove it after testing.

   Customer details are hashed (SHA-256) before they leave, as Meta requires.
   A shopper who opted out of tracking on the site is never sent. A failure
   here is logged and swallowed: it can never stop or slow an order by more
   than a few seconds. */

'use strict';
const crypto = require('crypto');

const GRAPH = 'https://graph.facebook.com/v21.0';
const DEFAULT_PIXEL = '4576703702572580';
// vinoshipper ids, also used as the pixel's content_ids
const SKU = { fourpack: '185926', case: '200144' };

const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const norm = v => String(v || '').trim().toLowerCase();
function hashed(v) { const n = norm(v); return n ? [sha(n)] : undefined; }
function phone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;            // us numbers need the country code
  return d ? [sha(d)] : undefined;
}

/* what both copies of the event say about the order */
function purchaseData(b) {
  const boxes = b.lineItems.reduce((n, li) => n + (li.kind === 'case' ? 6 : 1) * li.quantity, 0);
  return {
    value: +((b.cents.subtotal - b.cents.discount) / 100).toFixed(2),   // before shipping and tax
    currency: 'USD',
    content_ids: [...new Set(b.lineItems.map(li => SKU[li.kind] || String(li.productId)))],
    content_type: 'product',
    num_items: boxes,
  };
}

async function sendPurchase({ orderNumber, basket, customer, shipToAddress, event, browser }) {
  const token = (process.env.META_CAPI_TOKEN || '').trim();
  if (!token) return;
  const b = browser || {};
  if (b.optOut) return;                         // the site's "do not sell or share" switch

  const headers = (event && event.headers) || {};
  const ip = headers['x-nf-client-connection-ip'] ||
             String(headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;
  const addr = shipToAddress || {};

  const body = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: String(orderNumber),
      event_source_url: String(b.sourceUrl || 'https://maisonmaxine.world/checkout.html').slice(0, 500),
      action_source: 'website',
      user_data: {
        em: hashed(customer && customer.email),
        ph: phone((addr.phone && addr.phone.number) || ''),
        fn: hashed(addr.firstName),
        ln: hashed(addr.lastName),
        ct: hashed(String(addr.city || '').replace(/\s+/g, '')),
        st: hashed(addr.stateCode),
        zp: hashed(String(addr.postalCode || '').slice(0, 5)),
        country: hashed('us'),
        external_id: hashed(customer && customer.email),
        client_ip_address: ip,
        client_user_agent: headers['user-agent'] || undefined,
        fbp: b.fbp || undefined,
        fbc: b.fbc || undefined,
      },
      custom_data: purchaseData(basket),
    }],
  };
  const test = (process.env.META_TEST_EVENT_CODE || '').trim();
  if (test) body.test_event_code = test;

  const pixel = (process.env.META_PIXEL_ID || DEFAULT_PIXEL).trim();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3500);
  try {
    const res = await fetch(GRAPH + '/' + encodeURIComponent(pixel) + '/events?access_token=' + encodeURIComponent(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) console.error('[meta] purchase not accepted', orderNumber, res.status, JSON.stringify(d.error || d));
    else console.log('[meta] purchase sent', orderNumber, 'received', d.events_received);
  } catch (e) {
    console.error('[meta] purchase failed', orderNumber, e && e.name);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendPurchase, purchaseData };
