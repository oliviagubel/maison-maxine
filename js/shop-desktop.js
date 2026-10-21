/* ═══ SHOP, COMPUTERS ONLY ═══
   the shop's own bits that css can't do: the size radios, "choose the
   case" and the fall batch signup. the date, the sticker strips and the
   sparkles are site-wide, in js/site-desktop.js.
   on a phone this returns straight away and touches nothing. */
(function(){
  if (!matchMedia('(min-width:769px)').matches) return;

  function init(){
    /* the radio rows drive the same selectVariant the buttons always used */
    document.querySelectorAll('input[name="dtSize"]').forEach(function(r){
      r.addEventListener('change', function(){ if (r.checked && window.selectVariant) window.selectVariant(r.value); });
    });
    /* ── qty: how many of the picked set. it feeds the real cart quantity
       (selectVariant multiplies by it) and the price on the button ── */
    var qtyBox = document.getElementById('dtQty');
    function readQty(){
      var n = parseInt(String(qtyBox.value).replace(/\D/g, ''), 10);
      return Math.max(1, Math.min(12, n || 1));
    }
    if (qtyBox){
      qtyBox.addEventListener('input', function(){
        window.dtQtyMult = readQty();
        if (window.selectVariant && window.selectedVariant !== undefined) window.selectVariant(window.selectedVariant);
        else if (typeof selectVariant === 'function') selectVariant(document.querySelector('input[name="dtSize"]:checked').value);
      });
      qtyBox.addEventListener('blur', function(){ qtyBox.value = readQty(); });
    }

    /* ── add to bag on computers: a barber pole while it's added, then a
       confirmation in place, only once the bag really holds it ── */
    var progress = document.getElementById('mmwProgress');
    var added = document.getElementById('mmwAdded');
    window.dtAddFlow = function(addNow){
      if (!progress || !added) { addNow(); return; }
      added.innerHTML = '';
      progress.hidden = false;
      // let the bar paint, then add for real
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        var ok = false;
        try { ok = addNow(); } catch (e) { ok = false; }
        progress.hidden = true;
        added.innerHTML = ok
          ? 'added to your bag ♡ &nbsp;<a href="#" data-act="bag">view bag</a> | <a href="#" data-act="keep">keep shopping</a>'
          : 'that didn’t add. please try again.';
      }); });
    };
    if (added) added.addEventListener('click', function(e){
      var a = e.target.closest('a[data-act]');
      if (!a) return;
      e.preventDefault();
      if (a.dataset.act === 'bag' && window.openDrawer) window.openDrawer();
      else added.innerHTML = '';
    });

    /* ── "or express checkout with apple pay": the same wallet button, same flow ── */
    var xp = document.querySelector('.buy-row .xpay-btn');
    var xpLink = document.getElementById('mmwExpressLink');
    if (xp && xpLink){
      xpLink.addEventListener('click', function(e){ e.preventDefault(); xp.click(); });
      // say google pay when that's the wallet the device has
      new MutationObserver(function(){
        var name = xpLink.querySelector('.mmw-wallet');
        if (name) name.textContent = xp.classList.contains('is-google') ? 'Google Pay' : 'Apple Pay';
      }).observe(xp, {attributes:true, attributeFilter:['class']});
    }

    /* ── shipping / returns in the window's bottom strip: the words from the
       shipping & returns section, shown in place ── */
    var info = document.getElementById('mmwInfo');
    var shipBody = [].slice.call(document.querySelectorAll('.rh-acc details')).filter(function(d){
      return /shipping/i.test(d.querySelector('summary').textContent);
    })[0];
    var infoLinks = document.querySelectorAll('.mmw-strip a[data-info]');
    infoLinks.forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        if (!info || !shipBody) return;
        var open = a.getAttribute('aria-expanded') === 'true';
        infoLinks.forEach(function(b){ b.setAttribute('aria-expanded', 'false'); });
        if (open){ info.hidden = true; return; }
        var ps = [].slice.call(shipBody.querySelectorAll('.rh-acc-body p'));
        var pick = a.dataset.info === 'returns'
          ? ps.filter(function(p){ return /replace|credit|return/i.test(p.textContent); })
          : ps.filter(function(p){ return !/replace|credit|return/i.test(p.textContent); });
        info.innerHTML = '';
        pick.forEach(function(p){ info.appendChild(p.cloneNode(true)); });
        info.hidden = false;
        a.setAttribute('aria-expanded', 'true');
      });
    });

    /* ── the folder tabs: tablist / tab / tabpanel, arrow keys, home / end ── */
    var tabs = [].slice.call(document.querySelectorAll('.mm-tab'));
    function show(tab, focus){
      tabs.forEach(function(t){
        var on = t === tab;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function(t, i){
      t.addEventListener('click', function(){ show(t, false); });
      t.addEventListener('keydown', function(e){
        var k = e.key, j = null;
        if (k === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = tabs.length - 1;
        if (j === null) return;
        e.preventDefault();
        show(tabs[j], true);
      });
    });

    /* "what's in a gift box?" glides down to the case callout and its gift box photo */
    var giftInfo = document.getElementById('giftBoxInfo');
    if (giftInfo) giftInfo.addEventListener('click', function(e){
      var box = document.getElementById('case-callout');
      if (!box) return;
      e.preventDefault();
      box.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'center'});
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
        note.textContent = "That didn't go through. DM us @maisonmaxine.world on Instagram and we'll add you.";
      }).then(function(){ btn.disabled = false; });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
