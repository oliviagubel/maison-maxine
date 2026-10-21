/* ═══ THE SITE, COMPUTERS ONLY ═══
   the shared bits of the desktop pages that css can't do: today's date in
   the utility row, the bag count away from the shop, the sticker strips,
   and quieting the sparkles. loaded on shop, home, store locator,
   sustainability and compassion. on a phone it returns straight away and
   touches nothing. */
(function(){
  if (!matchMedia('(min-width:769px)').matches) return;

  function init(){
    /* today's date, the way an old shop header had it */
    var d = document.getElementById('utilDate');
    if (d) d.textContent = new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'});

    /* the bag count. the shop keeps it current itself (it owns the cart);
       elsewhere it's read once from the saved cart */
    var bag = document.getElementById('utilBagN');
    if (bag && typeof window.openDrawer !== 'function'){
      var n = 0;
      try {
        var c = JSON.parse(localStorage.getItem('maisonMaxineCart')) || {};
        n = (parseInt(c.fourpack) || 0) + (parseInt(c.case) || 0);
        if (!n && c.qty) n = parseInt(c.qty) || 0;
      } catch(e){}
      bag.textContent = n;
    }

    /* a thin strip of olivia's little stickers, under the header and above the footer */
    var STICKERS = ['littleshell.png', 'littledolphin.png', 'littleheart.png', 'littlebird.png'];
    document.querySelectorAll('.lil-strip').forEach(function(strip){
      if (strip.children.length) return;
      for (var i = 0; i < 16; i++){
        var img = document.createElement('img');
        img.src = STICKERS[i % STICKERS.length];
        img.alt = '';
        img.decoding = 'async';
        strip.appendChild(img);
      }
    });

    /* sparkles: almost all go. the tagline and the sidebar line keep theirs */
    var KEEP = '.tagline, .sidebar-sub';
    ['sidebar', 'main'].forEach(function(id){
      var root = document.getElementById(id);
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function(n){
          var p = n.parentNode;
          if (!p || /^(SCRIPT|STYLE)$/.test(p.nodeName) || p.closest(KEEP) || p.classList.contains('dt-spk')) return NodeFilter.FILTER_REJECT;
          return /[✦✧]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      var hits = [];
      while (walker.nextNode()) hits.push(walker.currentNode);
      hits.forEach(function(n){
        var frag = document.createDocumentFragment();
        n.nodeValue.split(/([✦✧])/).forEach(function(part){
          if (!part) return;
          if (part === '✦' || part === '✧'){
            var s = document.createElement('span');
            s.className = 'dt-spk';
            s.setAttribute('aria-hidden', 'true');
            s.textContent = part;
            frag.appendChild(s);
          } else frag.appendChild(document.createTextNode(part));
        });
        n.parentNode.replaceChild(frag, n);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* ═══ THE CURSOR TRAIL ═══
     after appledoll.com's: little pink × stars shed by the wine glass as it
     moves, more the faster it goes. each one falls and drifts a touch,
     shrinks halfway through its life, then fades to a dot and goes. up to
     200 at once, on one transparent canvas that never takes a click. it
     sleeps when nothing is moving, and stays off for reduced motion. */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MAX = 200, LIFE = 60, SPACING = 20;           // stars, frames (~1s at 60fps), px between stars
  var COLORS = ['#f4a9c8', '#f7bdd5', '#ee93ba'];   // appledoll's soft pink, a shade deeper so it shows on white
  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99998';
  var ctx = canvas.getContext('2d');
  var dpr = 1, stars = [], running = false, lastX = null, lastY = null;

  function size(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }

  function shed(x, y){
    if (stars.length >= MAX) stars.shift();
    var i = stars.length;
    stars.push({x:x, y:y, drift:((i % 5) - 2) / 5, life:LIFE, color:COLORS[(Math.random() * COLORS.length) | 0]});
  }

  function frame(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = stars.length - 1; i >= 0; i--){
      var s = stars[i];
      s.life--;
      if (s.life <= 0 || s.y > innerHeight){ stars.splice(i, 1); continue; }
      s.y += 1 + 3 * Math.random();
      s.x += s.drift;
      ctx.fillStyle = s.color;
      if (s.life > LIFE / 2){
        /* the star: a 10px ×, then a smaller one once it's half-lived */
        var r = s.life > LIFE * 0.75 ? 5 : 3;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-r, -1, r * 2, 2);
        ctx.fillRect(-1, -r, 2, r * 2);
        ctx.restore();
      } else {
        /* then a dot that shrinks */
        var d = s.life > LIFE / 4 ? 2 : 1;
        ctx.fillRect(s.x - d / 2, s.y - d / 2, d, d);
      }
    }
    if (stars.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  function wake(){ if (!running){ running = true; requestAnimationFrame(frame); } }

  document.addEventListener('mousemove', function(e){
    if (e.buttons) return;                          // not while dragging or selecting
    if (!canvas.isConnected){ size(); document.body.appendChild(canvas); }
    if (lastX === null){ lastX = e.clientX; lastY = e.clientY; }
    var dx = e.clientX - lastX, dy = e.clientY - lastY, dist = Math.sqrt(dx * dx + dy * dy);
    /* a star now, and more back along the path the faster it moved */
    if (dist > 0){
      var steps = Math.max(1, Math.floor(dist / SPACING));
      for (var k = 0; k < steps; k++){
        if (Math.random() < Math.min(1, dist / SPACING)){
          var t = k / steps;
          shed(e.clientX - dx * t + (Math.random() - .5) * 4, e.clientY - dy * t + (Math.random() - .5) * 4);
        }
      }
    }
    lastX = e.clientX; lastY = e.clientY;
    wake();
  }, {passive:true});
  window.addEventListener('resize', size);
})();
