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
