/* Square client — server side only.

   SQUARE_ACCESS_TOKEN is secret and only ever read here. The application id
   and location id are not secret (the card form in the page needs them) and
   are handed to the browser by /config.

   Sandbox or production is decided by the application id itself: Square's
   sandbox application ids start with "sandbox-". So switching to live is just
   pasting the production values into Netlify, with no code change. */

'use strict';

function settings() {
  const token = (process.env.SQUARE_ACCESS_TOKEN || '').trim();
  const applicationId = (process.env.SQUARE_APPLICATION_ID || '').trim();
  const locationId = (process.env.SQUARE_LOCATION_ID || '').trim();
  const sandbox = applicationId.startsWith('sandbox-');
  return {
    token, applicationId, locationId, sandbox,
    present: Boolean(token && applicationId && locationId),
    base: sandbox ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com',
  };
}

async function call(method, path, body) {
  const s = settings();
  if (!s.present) {
    const e = new Error('square is not configured');
    e.configMissing = true;
    throw e;
  }
  const res = await fetch(s.base + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + s.token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }
  if (!res.ok) {
    const e = new Error('square ' + method + ' ' + path + ' -> ' + res.status);
    e.status = res.status;
    e.data = data;
    // the first error code, e.g. CARD_DECLINED, decides what the customer is told
    e.code = data && data.errors && data.errors[0] && data.errors[0].code;
    throw e;
  }
  return data;
}

const square = {
  settings,
  createPayment: (body) => call('POST', '/v2/payments', body),
  refundPayment: (body) => call('POST', '/v2/refunds', body),
  locations:     ()     => call('GET',  '/v2/locations'),
};

/* what a customer should read for a declined card; never the raw error */
function declineMessage(code) {
  switch (code) {
    case 'CARD_DECLINED':
    case 'GENERIC_DECLINE':           return 'your card was declined. please try another card.';
    case 'INSUFFICIENT_FUNDS':        return 'your card was declined for insufficient funds.';
    case 'CVV_FAILURE':               return 'the security code did not match. please check it and try again.';
    case 'ADDRESS_VERIFICATION_FAILURE':
    case 'INVALID_POSTAL_CODE':       return 'the billing zip did not match your card. please check it.';
    case 'INVALID_EXPIRATION':
    case 'EXPIRATION_FAILURE':        return 'the expiry date is not valid for that card.';
    case 'INVALID_CARD':
    case 'INVALID_CARD_DATA':         return 'that card number is not valid.';
    case 'CARD_DECLINED_VERIFICATION_REQUIRED':
                                      return 'your bank needs to verify this payment. please try again.';
    default:                          return 'we could not take that payment. please try another card.';
  }
}

module.exports = { square, declineMessage };
