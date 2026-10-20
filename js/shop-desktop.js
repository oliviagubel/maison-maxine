/* ═══ SHOP, COMPUTERS ONLY ═══
   the small bits of the desktop shop page that css can't do: today's date
   in the utility row, the size radios, "choose the case", the little
   illustration strips, quieting the sparkles and the fall batch signup.
   on a phone this returns straight away and touches nothing. */
(function(){
  if (!matchMedia('(min-width:769px)').matches) return;

  function init(){
    /* today's date, the way an old shop header had it */
    var d = document.getElementById('utilDate');
    if (d) d.textContent = new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'});

    /* the radio rows drive the same selectVariant the buttons always used */
    document.querySelectorAll('input[name="dtSize"]').forEach(function(r){
      r.addEventListener('change', function(){ if (r.checked && window.selectVariant) window.selectVariant(r.value); });
    });
    var pick = document.getElementById('pickCase');
    if (pick) pick.addEventListener('click', function(e){
      e.preventDefault();
      if (window.selectVariant) window.selectVariant('case');
      var sizes = document.querySelector('.dt-sizes');
      if (sizes){
        sizes.scrollIntoView({behavior:'smooth', block:'center'});
        var r = sizes.querySelector('input[value="case"]');
        if (r) r.focus({preventScroll:true});
      }
    });

    /* a thin strip of olivia's little stickers, under the header and above the footer */
    var STICKERS = ['littleshell.png', 'littledolphin.png', 'littleheart.png', 'littlebird.png'];
    document.querySelectorAll('.lil-strip').forEach(function(strip){
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

    /* fall batch signup, to the same formspree list the snail mail club uses */
    var form = document.getElementById('fallSignup');
    var note = document.getElementById('fallSignupNote');
    if (form) form.addEventListener('submit', function(e){
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        note.textContent = 'Please enter your e-mail address.';
        form.elements.email.focus();
        return;
      }
      var btn = form.querySelector('button');
      btn.disabled = true;
      note.textContent = 'Sending...';
      fetch('https://formspree.io/f/mlgkzqka', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: JSON.stringify({name: name, email: email, list: 'fall batch', page: 'shop', _subject: 'fall batch: notify me'})
      }).then(function(r){
        if (!r.ok) throw new Error(r.status);
        form.reset();
        note.textContent = "Thank you! We'll e-mail you when the fall batch ships.";
      }).catch(function(){
        note.textContent = "That didn't go through. Please e-mail olivia@maisonmaxine.world and we'll add you.";
      }).then(function(){ btn.disabled = false; });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
