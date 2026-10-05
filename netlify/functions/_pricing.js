/* Order maths and creator codes — one place, so the quote the customer sees,
   the amount Stripe charges and the figures sent to Vinoshipper can never
   drift apart.

   Everything is in whole cents internally. Money in floats is how a cart ends
   up a penny off the charge. */

'use strict';

const FLAT_SHIPPING_CENTS = 700;      // we charge $7 UPS Ground and absorb the rest
const MIN_FOURPACK_BOXES  = 2;        // a single box is not sold

/* Creator codes: FirstNamexMaxine. 10% off four-packs, or a flat $99 case.
   Validated here, server side — a code typed in the page is never trusted. */
const CREATOR_CODES = [
  'CierraxMaxine',
];
const CASE_CODE_PRICE_CENTS = 9900;
const FOURPACK_PERCENT_OFF  = 10;

function normaliseCode(input) {
  if (!input) return null;
  const want = String(input).trim().toLowerCase();
  return CREATOR_CODES.find(c => c.toLowerCase() === want) || null;
}

/* lineItems: [{ productId, quantity, unitPriceCents, kind }]
   kind is 'fourpack' | 'case', used only to apply the creator rules. */
function priceOrder(lineItems, code) {
  const validCode = normaliseCode(code);
  let subtotal = 0;
  let discount = 0;

  for (const li of lineItems) {
    const gross = li.unitPriceCents * li.quantity;
    subtotal += gross;
    if (!validCode) continue;

    if (li.kind === 'case') {
      const target = CASE_CODE_PRICE_CENTS * li.quantity;
      if (target < gross) discount += gross - target;
    } else if (li.kind === 'fourpack') {
      discount += Math.round(gross * FOURPACK_PERCENT_OFF / 100);
    }
  }

  return {
    code: validCode,
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: FLAT_SHIPPING_CENTS,
  };
}

/* the discount object Vinoshipper expects, or null */
function vsDiscount(lineItems, code) {
  const p = priceOrder(lineItems, code);
  if (!p.code || p.discountCents <= 0) return null;
  return {
    productDiscount: {
      type: 'DOLLAR',
      value: +(p.discountCents / 100).toFixed(2),
      description: p.code,
    },
  };
}

function minimumsMet(lineItems) {
  const boxes = lineItems
    .filter(li => li.kind === 'fourpack')
    .reduce((n, li) => n + li.quantity, 0);
  const cases = lineItems
    .filter(li => li.kind === 'case')
    .reduce((n, li) => n + li.quantity, 0);
  if (cases > 0) return { ok: true };
  if (boxes >= MIN_FOURPACK_BOXES) return { ok: true };
  return { ok: false, reason: 'orders start at ' + MIN_FOURPACK_BOXES + ' gift boxes' };
}

/* 21+ on the day of the order */
function isOfAge(dob) {
  if (!dob) return false;
  const { year, month, day } = dob;
  if (!year || !month || !day) return false;
  const born = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(born.getTime())) return false;
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) {
    return false;                       // rejects things like 31 February
  }
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 21);
  return born <= cutoff;
}

module.exports = {
  FLAT_SHIPPING_CENTS, MIN_FOURPACK_BOXES, CREATOR_CODES,
  normaliseCode, priceOrder, vsDiscount, minimumsMet, isOfAge,
};
