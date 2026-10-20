/* ═══ 1996 ═══ the small bits of the computer layout that css can't do.
   everything this adds is hidden on phones by css/retro96.css, and nothing
   here touches the cart, checkout or any link to buy. */
(function(){
  var UPDATED = 'October 19, 2026';
  var EMAIL = 'olivia@maisonmaxine.world';
  var desktop = matchMedia('(min-width:769px)');

  /* ✦ and ✧ become a span the stylesheet turns into a 16px shell. on
     computers only: phones still see the glyph, untouched */
  var GLYPH = /[✦✧]/;
  var SKIP = {SCRIPT:1, STYLE:1, TITLE:1, TEXTAREA:1, INPUT:1, OPTION:1, SELECT:1, svg:1, NOSCRIPT:1};
  function wrapGlyphs(root){
    // phones keep the glyph exactly as it was, not even wrapped
    if (!desktop.matches || !root || SKIP[root.nodeName]) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        var p = n.parentNode;
        if (!p || SKIP[p.nodeName] || (p.classList && p.classList.contains('r96-spk'))) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('svg,script,style,textarea')) return NodeFilter.FILTER_REJECT;
        return GLYPH.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var hits = [];
    while (walker.nextNode()) hits.push(walker.currentNode);
    hits.forEach(function(n){
      var parts = n.nodeValue.split(/([✦✧])/);
      var frag = document.createDocumentFragment();
      parts.forEach(function(part){
        if (!part) return;
        if (part === '✦' || part === '✧'){
          var s = document.createElement('span');
          s.className = 'r96-spk';
          s.setAttribute('aria-hidden', 'true');
          s.textContent = part;
          frag.appendChild(s);
        } else frag.appendChild(document.createTextNode(part));
      });
      n.parentNode.replaceChild(frag, n);
    });
  }

  /* each page has its own css, much of it inline or !important, so the
     last of the 2026 look is cleared here, element by element, from what
     the browser actually computed. computers only. */
  var LINE = '#b8a1ad', CREAM = '#ffffff';
  var SANS = '"Gill Sans","Gill Sans MT","Gill Sans Nova",Calibri,"Helvetica Neue",Arial,sans-serif';
  var KEEP = '.r96-spk, .r96-foot, .r96-hr, .divider, .product-divider, .ship-strip, #mmPrivacyBar, .variant-opt, .variant-opt *, .add-btn, .hero-dot, .hero-dot *, svg, svg *, .leaflet-container, .leaflet-container *';
  var ITALIC_OK = 'blockquote, blockquote *, em, i, cite, .pd-quote, .pd-quote *, .store-vibe';
  var ORNAMENT = /^[\s✦✧♡♥·⋆*~•°+]+$/;
  function set(el, prop, val){ el.style.setProperty(prop, val, 'important'); }
  var CREAM_RGB = [255, 255, 255];
  function rgb(str){
    var m = /rgba?\(([^)]+)\)/.exec(str || '');
    if (!m) return null;
    var p = m[1].split(',').map(parseFloat);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function lum(c){
    return [0, 1, 2].reduce(function(sum, k, idx){
      var v = c[k] / 255;
      v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      return sum + v * [0.2126, 0.7152, 0.0722][idx];
    }, 0);
  }
  function contrast(a, b){
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function saturated(c){ return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) > 40; }
  /* the solid colour behind an element, or null when it's a photo */
  function groundOf(el){
    for (var e = el; e && e !== document.documentElement; e = e.parentElement){
      var s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage.indexOf('url(') > -1) return null;
      var b = rgb(s.backgroundColor);
      if (b && b[3] > 0.5) return b;
    }
    return CREAM_RGB;
  }
  function hasOwnText(el){
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  }
  function normalize(){
    if (!desktop.matches) return;
    var els = document.querySelectorAll('#sidebar *, #main, #main *, .r96-content, .r96-content *, .drawer, .drawer *, .age-bar, .toast');
    for (var i = 0; i < els.length; i++){
      var el = els[i];
      if (el.matches(KEEP)) continue;
      var cs = getComputedStyle(el);

      /* gradients go; one laid over a photo keeps the photo, loses the wash */
      var bg = cs.backgroundImage;
      if (bg && bg.indexOf('gradient') > -1){
        var urls = bg.match(/url\([^)]*\)/g);
        set(el, 'background-image', urls ? urls.join(',') : 'none');
        if (!urls) set(el, 'background-color', CREAM);
      }
      if (el.closest('#sidebar')) continue;   // the nav is styled in full by the css

      /* pixel and script display faces → gill sans (headings keep klickclack) */
      if (!/^H[1-6]$/.test(el.tagName) && !el.closest('h1,h2,h3,h4,h5,h6,.banner h1,.box-title') &&
          /Pixelify|Cormorant|Great Vibes|monospace|cursive/i.test(cs.fontFamily)) set(el, 'font-family', SANS);

      /* nothing small enough to squint at */
      if (parseFloat(cs.fontSize) < 13 && el.textContent.trim()) set(el, 'font-size', '13px');

      /* readable contrast (WCAG AA) against whatever the text actually sits
         on: on a light ground, coloured text gets the deep rose and grey-ish
         text the dark neutral; on a dark ground it goes white. text over a
         photo is left alone. */
      // (rows that light up when picked are skipped: an inline colour would
      // stay behind when the highlight moves on)
      if (el.childNodes.length && hasOwnText(el) && !el.closest('a, button, .active, .playing, .selected, .is-on, [aria-selected="true"], tr, li[class]')){
        var c = rgb(cs.color), ground = groundOf(el);
        if (c && c[3] > 0 && ground){
          var big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && parseInt(cs.fontWeight, 10) >= 700);
          var need = big ? 3 : 4.5;
          if (contrast(c, ground) < need){
            var fix = lum(ground) < 0.2 ? [255, 255, 255] : saturated(c) ? [163, 36, 95] : [90, 58, 74];
            if (contrast(fix, ground) < need) fix = lum(ground) < 0.18 ? [255, 255, 255] : [0, 0, 0];
            set(el, 'color', 'rgb(' + fix.join(',') + ')');
          }
        }
      }

      /* plain upright text, except real quotes */
      if (cs.fontStyle === 'italic' && !el.matches(ITALIC_OK)) set(el, 'font-style', 'normal');
      if (parseFloat(cs.letterSpacing) > 0.5) set(el, 'letter-spacing', 'normal');

      /* long centered paragraphs read left-aligned */
      if (cs.textAlign === 'center' && !el.closest('.banner,h1,h2,h3,button') && cs.display === 'block' &&
          el.children.length < 4 && el.textContent.trim().length > 70) set(el, 'text-align', 'left');

      /* dotted, dashed, pink and thick borders → one 1px solid rule */
      ['top','right','bottom','left'].forEach(function(side){
        var w = parseFloat(cs['border-' + side + '-width']);
        var st = cs['border-' + side + '-style'];
        if (!w || st === 'none' || st === 'hidden') return;
        if (el.matches('input, textarea, select, button')) return;
        set(el, 'border-' + side, '1px solid ' + LINE);
      });

      /* tilted cards sit straight (cut-out photos and stickers keep their tilt) */
      if (cs.transform && cs.transform !== 'none' && el.tagName !== 'IMG' && !el.querySelector('img') &&
          (parseFloat(cs.borderTopWidth) || cs.backgroundColor !== 'rgba(0, 0, 0, 0)')) set(el, 'transform', 'none');

      /* a row of ✦ ♡ ✦ used as a divider becomes a plain rule */
      if (el.children.length < 6 && !el.querySelector('img, a, button, input') &&
          ORNAMENT.test(el.textContent) && el.textContent.trim().length > 2 &&
          (cs.display === 'block' || cs.display === 'flex')){
        el.textContent = '';
        el.classList.add('r96-hr');
      }
    }
  }

  function addSidebarBits(){
    var side = document.getElementById('sidebar');
    if (!side || side.querySelector('.r96-updated')) return;
    var navs = side.querySelectorAll('.nav-section');
    var last = navs[navs.length - 1] || side.firstElementChild;

    /* the cart lives in the nav now, where the floating bubble used to be */
    if (typeof window.openDrawer === 'function'){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'r96-cart';
      b.innerHTML = 'cart (<span class="r96-cart-n">0</span>)';
      b.addEventListener('click', function(){ window.openDrawer(); });
      (last.querySelector('nav') || last).appendChild(b);
      syncCart();
    }

    var u = document.createElement('div');
    u.className = 'r96-updated';
    u.textContent = 'last updated ' + UPDATED;
    last.parentNode.insertBefore(u, last.nextSibling);
  }

  function syncCart(){
    var n = document.querySelector('.r96-cart-n');
    var src = document.getElementById('cartCount');
    if (!n || !src) return;
    var v = (src.textContent || '0').trim() || '0';
    if (n.textContent !== v) n.textContent = v;   // only on change, or the observer below feeds itself
  }

  function addFooter(){
    if (document.querySelector('.r96-foot')) return;
    var f = document.createElement('div');
    f.className = 'r96-foot';
    f.innerHTML = '<span>© 2026 Maison Maxine · <a href="https://maisonmaxine.world/">maisonmaxine.world</a> · <a href="mailto:' + EMAIL + '">email us</a></span>';
    document.body.appendChild(f);
  }

  function init(){
    addSidebarBits();
    addFooter();
    wrapGlyphs(document.body);
    normalize();
    window.addEventListener("load", normalize);

    /* the cart count, drawer and toasts redraw themselves; keep up */
    var src = document.getElementById('cartCount');
    var pending = false;
    new MutationObserver(function(muts){
      if (src) syncCart();
      if (pending) return;
      pending = true;
      requestAnimationFrame(function(){
        pending = false;
        muts.forEach(function(m){ m.addedNodes.forEach(function(n){
          if (n.nodeType === 1) wrapGlyphs(n);
          else if (n.nodeType === 3 && GLYPH.test(n.nodeValue) && n.parentNode) wrapGlyphs(n.parentNode);
        }); });
      });
    }).observe(document.body, {childList:true, subtree:true, characterData:true});

    desktop.addEventListener && desktop.addEventListener("change", function(){ wrapGlyphs(document.body); normalize(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
