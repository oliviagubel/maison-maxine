/* ═══════════════════════════════════════════════════════════════════════════
   MAISON MAXINE — FUNNEL TRACKING
   One file, loaded on every public page.

   Loads Meta Pixel + Microsoft Clarity, then reports the funnel. Every hook
   here is a passive listener or an observer: nothing in this file changes how
   the site looks or behaves, and nothing touches the age gate's own logic or
   the Vinoshipper checkout.

   No personal information is ever sent — no names, emails, birth dates, cart
   contents or survey answers. Only the event name, the product option, a
   price already printed on the page, and the utm tags from the ad click.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── CONFIGURE ─────────────────────────────────────────────────────────
     Replace both placeholders with the real ids. While they're still
     "PIXEL_ID" / "CLARITY_ID" nothing loads, so the site never fires requests
     at a pixel that doesn't exist. */
  var PIXEL_ID   = 'PIXEL_ID';
  var CLARITY_ID = 'CLARITY_ID';
  var DEBUG      = false;   // true → log every event to the console
  /* ──────────────────────────────────────────────────────────────────────── */

  function log() {
    if (!DEBUG) return;
    var a = ['%c[track]', 'color:#d371a1;font-weight:bold'];
    console.log.apply(console, a.concat([].slice.call(arguments)));
  }

  /* ═══ CCPA OPT-OUT ═══
     Checked before either tool loads. Kept in localStorage so it survives the
     session; it is per browser, which is the honest limit of a client-side
     opt-out and is stated as such on the privacy page. */
  var OPT_KEY = 'mmDoNotSell';
  function optedOut() {
    try { return localStorage.getItem(OPT_KEY) === '1'; } catch (e) { return false; }
  }
  function setOptOut(v) {
    try { v ? localStorage.setItem(OPT_KEY, '1') : localStorage.removeItem(OPT_KEY); } catch (e) {}
  }

  var configured = { pixel: PIXEL_ID !== 'PIXEL_ID', clarity: CLARITY_ID !== 'CLARITY_ID' };
  if (optedOut()) { configured.pixel = configured.clarity = false; }
  if (!configured.pixel)   log('Meta Pixel not loaded — PIXEL_ID is still a placeholder');
  if (!configured.clarity) log('Clarity not loaded — CLARITY_ID is still a placeholder');

  /* ═══ UTM: captured on landing, kept for the whole session ═══
     Stored so the tags still travel with events on later pages, after the
     query string is gone from the url. */
  var UTM_KEY = 'mmUtm';
  var UTM_FIELDS = ['utm_source', 'utm_campaign', 'utm_content'];

  function readUtm() {
    var q = new URLSearchParams(location.search), found = {}, any = false;
    UTM_FIELDS.forEach(function (k) {
      var v = q.get(k);
      if (v) { found[k] = String(v).slice(0, 100); any = true; }
    });
    if (any) {
      try { sessionStorage.setItem(UTM_KEY, JSON.stringify(found)); } catch (e) {}
      return found;
    }
    try { return JSON.parse(sessionStorage.getItem(UTM_KEY)) || {}; } catch (e) { return {}; }
  }
  var utm = readUtm();

  /* ═══ LOADERS ═══ */
  if (configured.pixel) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    log('PageView');
  }

  if (configured.clarity) {
    (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})
    (window,document,'clarity','script',CLARITY_ID);
    // tag the session so recordings can be filtered by ad
    Object.keys(utm).forEach(function (k) { try { clarity('set', k, utm[k]); } catch (e) {} });
  }

  /* ═══ FIRE ═══
     `key` defaults to the event name, so each event fires once per page load.
     ScrollDepth passes its own key per threshold, since that one is meant to
     fire four times. */
  var sent = {};
  function track(name, standard, params, key, clarityName) {
    key = key || name;
    if (sent[key]) { log('skipped (already sent this page):', key); return; }
    sent[key] = true;

    var payload = {};
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] !== null && params[k] !== undefined) payload[k] = params[k];
    });
    // attribution travels with everything, so any step of the funnel can be
    // read back to the ad that produced it
    Object.keys(utm).forEach(function (k) { payload[k] = utm[k]; });

    try {
      if (window.fbq) fbq(standard ? 'track' : 'trackCustom', name, payload);
    } catch (e) { log('fbq failed', e); }
    try {
      // clarity custom events take a name only, so anything that varies is
      // folded into the name and the detail is set as a filterable tag
      if (window.clarity) clarity('event', clarityName || name);
    } catch (e) { log('clarity failed', e); }

    log((standard ? 'track' : 'trackCustom') + ':', name, payload);
  }
  function tag(k, v) { try { if (window.clarity && v != null) clarity('set', k, String(v)); } catch (e) {} }

  /* ═══ THE LINK ═══
     Injected on every page so the control exists wherever someone lands, and
     rendered even when they have already opted out — otherwise there would be
     no way back. Deliberately quiet: 10px, muted, at the very foot. */
  function renderOptOut() {
    if (document.getElementById('mmPrivacyBar')) return;
    var off = optedOut();

    var bar = document.createElement('div');
    bar.id = 'mmPrivacyBar';
    // body is display:flex on this site, so appending there would make the bar
    // a stretched flex item beside the content — it belongs in the content column
    var host = document.getElementById('main') || document.querySelector('main') || document.body;
    // and on the shop page a sticky buy bar sits over the foot, so clear it
    var sticky = document.querySelector('.buybar');
    var clear = (sticky && getComputedStyle(sticky).display !== 'none') ? sticky.offsetHeight + 12 : 0;

    // #main is a flex column on some pages and the footer carries order:9,
    // so an unordered bar would land mid-page instead of at the foot
    bar.style.cssText = 'order:99;flex:0 0 auto;width:100%;text-align:center;' +
      'padding:14px 16px calc(18px + ' + clear + 'px);' +
      'font-family:\'Pixelify Sans\',sans-serif;font-size:9px;letter-spacing:.1em;' +
      'text-transform:uppercase;color:#8a6a7a;line-height:1.9;opacity:.75';

    var privacy = document.createElement('a');
    privacy.href = '/privacy.html';
    privacy.textContent = 'privacy';
    privacy.style.cssText = 'color:#8a6a7a;text-decoration:none;border-bottom:1px dotted #cbb3bf';

    var sep = document.createElement('span');
    sep.textContent = '  \u2726  ';

    var dns = document.createElement('a');
    dns.href = '/privacy.html#privacy';
    dns.id = 'mmDns';
    dns.style.cssText = privacy.style.cssText + ';cursor:pointer';
    dns.textContent = off ? 'tracking is off \u2014 turn it back on'
                          : 'do not sell or share my personal information';
    dns.addEventListener('click', function (e) {
      e.preventDefault();
      var nowOff = !optedOut();
      setOptOut(nowOff);
      // a reload is the only way to actually stop clarity once it is recording
      location.reload();
    });

    bar.appendChild(privacy); bar.appendChild(sep); bar.appendChild(dns);
    host.appendChild(bar);

    // the privacy page's own button, when present
    var big = document.getElementById('dnsBig');
    if (big) {
      var txt = document.getElementById('dnsBigTxt');
      var note = document.getElementById('dnsBigNote');
      if (txt) txt.textContent = off ? 'turn tracking back on' : 'do not sell or share my personal information';
      if (note) note.textContent = off
        ? 'meta pixel and clarity are off in this browser \u2726 nothing is being collected'
        : '';
      big.addEventListener('click', function () { setOptOut(!optedOut()); location.reload(); });
    }
  }

  /* ═══ HOOKS ═══ */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    renderOptOut();

    if (optedOut()) { log('opted out — no pixel, no clarity, no events'); return; }

    /* ── 1-3. age gate ───────────────────────────────────────────────────
       Read only. The gate decides before first paint and stamps .age-ok on
       <html> for a remembered visitor; we look at the result rather than
       touching the logic. */
    var gate = document.getElementById('ageGate');
    var remembered = document.documentElement.classList.contains('age-ok');

    // NB: the gate is position:fixed, so offsetParent is always null on it —
    // getComputedStyle is the check that actually works here
    var gateVisible = gate && getComputedStyle(gate).display !== 'none';

    if (gate && !remembered && gateVisible) {
      track('AgeGateShown', false);
      var yes = document.getElementById('agYes');
      if (yes) yes.addEventListener('click', function () { track('AgeGatePassed', false); });
    } else if (remembered) {
      track('AgeGateSkipped', false);
    }

    /* ── 4. ViewContent: the product section reaches the screen ───────── */
    var product = document.querySelector('.product-details');
    if (product && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          track('ViewContent', true, {
            content_name: 'Red Wine Spritz',
            content_type: 'product',
            currency: 'USD',
            value: 56
          });
          io.disconnect();
        });
      }, { threshold: 0.3 });
      io.observe(product);
    }

    /* ── 5. scroll depth ─────────────────────────────────────────────── */
    var marks = [25, 50, 75, 100], ticking = false;
    function depth() {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      var pct = scrollable <= 0 ? 100 : ((window.scrollY || doc.scrollTop) / scrollable) * 100;
      marks.forEach(function (m) {
        if (pct + 0.5 >= m) {
          track('ScrollDepth', false, { percent: m }, 'ScrollDepth:' + m, 'ScrollDepth_' + m);
        }
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(depth);
    }, { passive: true });
    depth(); // a short page can already be at 100%

    /* ── 6. option selected ──────────────────────────────────────────── */
    var OPTIONS = { 'variant-fourpack': { option: 'pair', value: 56 },
                    'variant-case':     { option: 'case', value: 144 } };
    Object.keys(OPTIONS).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function () {
        var o = OPTIONS[id];
        tag('option', o.option);
        track('OptionSelected', false, { option: o.option, value: o.value, currency: 'USD' });
      });
    });

    /* which option is live right now, for AddToCart */
    function chosen() {
      var el = document.querySelector('.variant-opt.selected');
      if (el && el.id === 'variant-case') return { option: 'case', value: 144 };
      return { option: 'pair', value: 56 };
    }

    /* ── 7. add to cart (both the main button and the sticky bar) ────── */
    var addEls = [document.getElementById('addBtn')].concat(
      [].slice.call(document.querySelectorAll('.buybar-btn'))
    ).filter(Boolean);
    addEls.forEach(function (el) {
      el.addEventListener('click', function () {
        var c = chosen();
        track('AddToCart', true, {
          content_name: 'Red Wine Spritz',
          content_type: 'product',
          option: c.option,
          value: c.value,
          currency: 'USD'
        });
      });
    });

    /* ── 8. initiate checkout ────────────────────────────────────────── */
    function cartValue() {
      try {
        if (typeof window.getCart === 'function' && typeof window.cartSubtotal === 'function') {
          var v = window.cartSubtotal(window.getCart());
          if (typeof v === 'number' && v > 0) return v;
        }
      } catch (e) {}
      return null;
    }
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var hit = t.closest(
        'vinoshipper-cart, vinoshipper-cart-icon, [class*="vinoshipper"], ' +
        '.drawer-checkout, ' +
        'a[href*="vinoshipper.com/cart"], a[href*="/apps/checkout"]'
      );
      if (!hit) return;
      track('InitiateCheckout', true, {
        content_name: 'Red Wine Spritz',
        value: cartValue(),
        currency: 'USD'
      });
    }, true);

    /* ── 9. merch clicks ─────────────────────────────────────────────── */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var cta = t.closest('.merch-cta');
      if (!cta) return;
      var card = cta.closest('.merch-card');
      var nameEl = card && card.querySelector('.merch-name');
      var product = nameEl ? nameEl.textContent.trim() : (cta.textContent || '').trim();
      tag('merch', product);
      track('MerchClick', false, { product: product });
    }, true);

    log('ready — utm:', utm);
  });
})();
