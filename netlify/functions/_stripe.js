'use strict';
const Stripe = require('stripe');

function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const e = new Error('stripe secret key is not configured');
    e.configMissing = true;
    throw e;
  }
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

/* Stripe metadata allows 500 chars per value, so a payload is stored in
   numbered chunks and reassembled in the webhook. This is also what makes the
   whole flow stateless: everything needed to raise the Vinoshipper order
   travels with the payment, so there is no database to fall out of step. */
function packMeta(obj, prefix) {
  const s = JSON.stringify(obj);
  const out = {};
  const SIZE = 480;
  let n = 0;
  for (let i = 0; i < s.length; i += SIZE) out[prefix + n++] = s.slice(i, i + SIZE);
  if (n > 40) throw new Error('order payload too large for stripe metadata');
  out[prefix + 'n'] = String(n);
  return out;
}

function unpackMeta(meta, prefix) {
  const n = parseInt(meta[prefix + 'n'], 10);
  if (!n) return null;
  let s = '';
  for (let i = 0; i < n; i++) s += meta[prefix + i] || '';
  try { return JSON.parse(s); } catch (e) { return null; }
}

module.exports = { stripe, packMeta, unpackMeta };
