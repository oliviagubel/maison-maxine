/* Shared helpers for the Maison Maxine checkout API.
   Runs on Netlify (himaisonmaxine.com); the shop itself stays on GitHub Pages
   and calls these cross-origin.

   The Vinoshipper key and secret are read from the environment and are never
   returned, logged, or sent to the browser. They exist only in Netlify's env
   vars — nothing in this repo contains them. */

'use strict';

// only the shop may call these endpoints
const ALLOWED = [
  'https://maisonmaxine.world',
  'https://www.maisonmaxine.world',
];

function cors(origin) {
  const ok = ALLOWED.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(status, body, origin) {
  return {
    statusCode: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors(origin)),
    body: JSON.stringify(body),
  };
}

/* a handler wrapper: CORS preflight, origin check, JSON parsing, and a
   catch-all so an unexpected throw never leaks a stack trace to the browser */
function handler(fn) {
  return async (event) => {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: cors(origin), body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'method not allowed' }, origin);
    }
    if (origin && !ALLOWED.includes(origin)) {
      return json(403, { error: 'origin not allowed' }, origin);
    }

    let body = {};
    if (event.body) {
      try { body = JSON.parse(event.body); }
      catch (e) { return json(400, { error: 'invalid json' }, origin); }
    }

    try {
      return await fn(body, origin);
    } catch (e) {
      // log server-side only; the browser gets nothing useful to an attacker
      console.error('[checkout] unhandled:', e && e.message);
      return json(500, { error: 'something went wrong' }, origin);
    }
  };
}

/* credentials, read from the environment at call time */
function credentials() {
  const key = (process.env.VINOSHIPPER_API_KEY || '').trim();
  const secret = (process.env.VINOSHIPPER_API_SECRET || '').trim();
  return {
    present: Boolean(key && secret),
    // basic auth per Vinoshipper's server-to-server docs
    authHeader: key && secret
      ? 'Basic ' + Buffer.from(key + ':' + secret).toString('base64')
      : null,
  };
}

module.exports = { json, handler, credentials, ALLOWED };
