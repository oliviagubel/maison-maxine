/* Girls Night Giveaway: download every entry as a CSV.

   Private: open https://himaisonmaxine.com/api/giveaway-export?key=YOUR_KEY
   where YOUR_KEY is the value of the GIVEAWAY_EXPORT_KEY environment
   variable in Netlify (Site configuration > Environment variables). Without
   that variable set, nothing is exported.

   after adding or changing the variable, netlify needs a real build to pick
   it up. netlify.toml skips builds when nothing under netlify/ changed, so a
   plain "trigger deploy" can be skipped: use "clear cache and deploy site". */

'use strict';
const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');

const STORE = 'girls-night-giveaway';
const COLUMNS = ['enteredAt', 'firstName', 'email', 'age21', 'optIn', 'utmSource', 'utmCampaign'];

function text(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, body };
}

function sameKey(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function cell(v) {
  let s = v == null ? '' : String(v);
  // keep spreadsheets from treating a value as a formula
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return text(405, 'method not allowed');

  const expected = (process.env.GIVEAWAY_EXPORT_KEY || '').trim();
  if (!expected) return text(503, 'export is not set up: add GIVEAWAY_EXPORT_KEY in Netlify');
  const given = ((event.queryStringParameters || {}).key || '').trim();
  if (!given || !sameKey(given, expected)) return text(403, 'not allowed');

  try {
    connectLambda(event);
    const store = getStore(STORE);
    const { blobs } = await store.list();
    const rows = [];
    for (const b of blobs) {
      const e = await store.get(b.key, { type: 'json' });
      if (e) rows.push(e);
    }
    rows.sort((a, b) => String(a.enteredAt).localeCompare(String(b.enteredAt)));
    const csv = [COLUMNS.join(',')]
      .concat(rows.map(r => COLUMNS.map(c => cell(r[c])).join(',')))
      .join('\r\n') + '\r\n';
    const day = new Date().toISOString().slice(0, 10);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="girls-night-giveaway-' + day + '.csv"',
        'Cache-Control': 'no-store',
      },
      body: csv,
    };
  } catch (e) {
    console.error('[giveaway-export]', e && e.message);
    return text(500, 'could not read entries');
  }
};
