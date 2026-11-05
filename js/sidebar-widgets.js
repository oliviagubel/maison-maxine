/* ═══ THE SIDEBAR WIDGETS, COMPUTERS ONLY ═══
   one copy for every page with a sidebar (markup lives in each page's
   sidebar, styles in css/sidebar-widgets.css).

   now playing: a little winamp-style deck that plays the real 30-second
   itunes previews of the muses' picks. play/pause, previous, next, a seek
   groove, a clock that flips to time-remaining when clicked (like winamp's),
   a live spectrum from the web audio analyser, and eject opens the aux
   (playlist.html). nothing ever plays until someone presses play.

   malibu weather: live from open-meteo, cached for 15 minutes so moving
   between pages doesn't refetch. big temperature, a pixel condition icon,
   a one-liner that changes with the weather, and a 3-day forecast behind
   a disclosure button.

   phones never see the sidebar, so nothing here runs below 769px. */
(function(){
  if(!window.matchMedia || !window.matchMedia('(min-width:769px)').matches) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── pixel icons: 11×11 grids, one rect per lit pixel ── */
  var PAL = {Y:'#f5b82e',O:'#e2892a',M:'#f6dc84',N:'#c9a24a',W:'#ffffff',G:'#93a6ba',L:'#d9e2ec',B:'#4f9ad6',S:'#9cc6ea'};
  var CLOUD_LOW = ['....GGG....','...GWWWG...','.GGGWWWWGG.','GWWWWWWWWWG','GLWWWWWWWLG','.GGGGGGGGG.'];
  var GRIDS = {
    sun:   ['.....Y.....','.Y.......Y.','...OOOOO...','..OYYYYYO..','..OYYYYYO..','Y.OYYYYYO.Y','..OYYYYYO..','..OYYYYYO..','...OOOOO...','.Y.......Y.','.....Y.....'],
    moon:  ['...........','....NNN....','...NMMN....','..NMMN.....','..NMMN.....','..NMMN.....','..NMMMN....','...NMMMNNN.','....NMMMMN.','.....NNNN..','...........'],
    cloud: ['...........','...........','....GGG....','...GWWWG...','.GGGWWWWGG.','GWWWWWWWWWG','GWWWWWWWWWG','GLWWWWWWWLG','.GGGGGGGGG.','...........','...........'],
    part:  ['.Y.Y.......','..OOO......','YOYYYO.....','.OYYGGG....','.OYGWWWG...','..GGWWWWGG.','.GWWWWWWWWG','.GWWWWWWWWG','.GLWWWWWWLG','..GGGGGGGG.','...........'],
    fog:   ['...........','...........','.GGGGGGGG..','...........','...GGGGGGGG','...........','.GGGGGGGG..','...........','...GGGGGGGG','...........','...........'],
    drizzle: CLOUD_LOW.concat(['...........','...B....B..','...........','.....B.....','...........']),
    rain:  CLOUD_LOW.concat(['...........','..B...B...B','.B...B...B.','...........','..B...B....']),
    snow:  CLOUD_LOW.concat(['...........','..S...S...S','...........','.S...S...S.','...........']),
    storm: ['....GGG....','...GWWWG...','.GGGWWWWGG.','GWWWWWWWWWG','GLWWWWWWWLG','.GGGGYGGGG.','.....YY....','....YY.....','.....YY....','....Y......','...........']
  };
  function pixelIcon(name){
    var g = GRIDS[name] || GRIDS.sun, r = '';
    for(var y=0;y<g.length;y++) for(var x=0;x<g[y].length;x++){
      var c = PAL[g[y][x]]; if(c) r += '<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+c+'"/>';
    }
    return '<svg viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true" focusable="false">'+r+'</svg>';
  }

  /* ════════════════ NOW PLAYING ════════════════ */
  (function(){
    var root = document.querySelector('.mmp'); if(!root) return;
    // itunes track ids, so the preview is always the right recording
    var TRACKS = [
      {id:6794050137, artist:'phantom planet', song:'california', len:'3:11'},
      {id:1742301417, artist:'clairo', song:'sexy to someone', len:'3:27'},
      {id:1807425306, artist:'lana del rey', song:'henry, come on', len:'5:11'},
      {id:1440918404, artist:'kacey musgraves', song:'golden hour', len:'3:18'},
      {id:1871502698, artist:'maisie peters', song:'my regards', len:'3:11'},
      {id:716192621,  artist:'katy perry', song:'california gurls', len:'3:54'},
      {id:1146195714, artist:'frank ocean', song:'pink + white', len:'3:04'},
      {id:275765380,  artist:'kelly clarkson', song:'since u been gone', len:'3:08'},
      {id:171980163,  artist:'cassie', song:'me & u', len:'3:12'},
      {id:1163931703, artist:'stevie nicks', song:'edge of seventeen', len:'5:29'}
    ];
    var $ = function(s){return root.querySelector(s)};
    var playBtn=$('.mmp-play'), prevBtn=$('.mmp-prev'), nextBtn=$('.mmp-next'),
        seek=$('.mmp-seek'), timeBtn=$('.mmp-time'), digits=$('.mmp-digits'),
        mq=$('.mmp-marquee'), mqText=$('.mmp-t'), mqEcho=$('.mmp-echo'), mqLink=$('.mmp-link'),
        trk=$('.mmp-trk'), stereo=$('.mmp-st'), src=$('.mmp-src'), canvas=$('.mmp-vis'), status=$('.mmp-status');

    var idx = parseInt(localStorage.getItem('mm_aux_track'),10);
    if(!(idx>=0 && idx<TRACKS.length)) idx = Math.floor(Math.random()*TRACKS.length);
    var audio = new Audio(); audio.crossOrigin='anonymous'; audio.preload='none'; audio.volume=.7;
    var loadedId=null, remaining=false, wantPlay=false, ctx=null, analyser=null, bins=null, raf=0, peaks=[];
    var cache = {}; try{ cache = JSON.parse(sessionStorage.getItem('mm_aux_cache')||'{}'); }catch(e){}

    function pad2(n){return (n<10?'0':'')+n}
    function clock(s){ s=Math.max(0,Math.floor(s||0)); return Math.floor(s/60)+':'+pad2(s%60); }
    function say(msg){ status.textContent=msg; }

    function setMarquee(text){
      mqText.textContent = text; mqEcho.textContent = text;
      mq.classList.remove('is-scrolling');
      requestAnimationFrame(sizeMarquee);
    }
    function sizeMarquee(){
      var over = mqText.offsetWidth > mq.clientWidth;
      mq.classList.toggle('is-long', over);
      // winamp scrolls a character at a time; so do we, but only while playing
      var on = over && !audio.paused && !reduceMotion.matches;
      if(on){
        var w = mqText.offsetWidth + 18;  // one copy plus the gap
        mq.style.setProperty('--mq-w', w+'px');
        mq.style.setProperty('--mq-steps', Math.round(w/4));
        mq.style.setProperty('--mq-dur', (w/22).toFixed(1)+'s');
      }
      mq.classList.toggle('is-scrolling', on);
    }

    function showTrack(){
      var t = TRACKS[idx], n = idx+1;
      setMarquee(n+'. '+t.artist+' - '+t.song+' ('+t.len+')');
      trk.textContent = pad2(n)+'/'+TRACKS.length;
      var info = cache[t.id];
      var url = info && info.page ? info.page : 'https://music.apple.com/us/search?term='+encodeURIComponent(t.artist+' '+t.song);
      mqLink.href = url; src.href = url;
      mqLink.setAttribute('aria-label', t.song+' by '+t.artist+', on apple music');
      seek.value = 0; seek.max = 30; seek.disabled = true;
      seek.setAttribute('aria-valuetext','0:00 of 0:30');
      seek.style.setProperty('--p','0%');
      paintTime();
    }

    function paintTime(){
      var cur = audio.currentTime||0, dur = (loadedId===TRACKS[idx].id && audio.duration) || 30;
      digits.textContent = remaining ? '-'+clock(dur-cur) : clock(cur);
      if(!seek.disabled){
        seek.value = cur;
        seek.setAttribute('aria-valuetext', clock(cur)+' of '+clock(dur));
        seek.style.setProperty('--p', (cur/dur*100).toFixed(2)+'%');
      }
    }

    function lookup(t){
      if(cache[t.id] && cache[t.id].preview) return Promise.resolve(cache[t.id]);
      return fetch('https://itunes.apple.com/lookup?country=us&id='+t.id)
        .then(function(r){return r.json()})
        .then(function(d){
          var r = d && d.results && d.results[0];
          if(!r || !r.previewUrl) throw new Error('no preview');
          cache[t.id] = {preview:r.previewUrl, page:r.trackViewUrl};
          try{ sessionStorage.setItem('mm_aux_cache', JSON.stringify(cache)); }catch(e){}
          mqLink.href = src.href = r.trackViewUrl;
          return cache[t.id];
        });
    }

    function setupAnalyser(){
      if(ctx || !(window.AudioContext||window.webkitAudioContext)) return;
      try{
        ctx = new (window.AudioContext||window.webkitAudioContext)();
        var node = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .72;
        node.connect(analyser); analyser.connect(ctx.destination);
        bins = new Uint8Array(analyser.frequencyBinCount);
      }catch(e){ ctx = null; analyser = null; }
    }


    // fetch every preview url up front in one request, so pressing play can
    // start the audio inside the tap itself (safari, iphones especially,
    // refuse audio that only starts after a network round trip)
    function prefetch(ids){
      ids = ids.filter(function(id){ return id && !(cache[id] && cache[id].preview); });
      if(!ids.length) return;
      fetch('https://itunes.apple.com/lookup?country=us&id='+ids.join(','))
        .then(function(r){return r.json()})
        .then(function(d){
          (d.results||[]).forEach(function(r){ if(r.previewUrl) cache[r.trackId]={preview:r.previewUrl, page:r.trackViewUrl}; });
          try{ sessionStorage.setItem('mm_aux_cache', JSON.stringify(cache)); }catch(e){}
          var c = cache[TRACKS[idx].id]; if(c && c.page){ mqLink.href = src.href = c.page; }
        }).catch(function(){});
    }

    function play(){
      var t = TRACKS[idx]; wantPlay = true;
      setupAnalyser();                       // inside the click, so browsers allow it
      if(ctx && ctx.state==='suspended') ctx.resume();
      if(loadedId===t.id){ audio.play().catch(onFail); return; }
      root.classList.add('is-buffering'); say('buffering '+t.song);
      function start(info){ loadedId = t.id; audio.src = info.preview; return audio.play(); }
      if(cache[t.id] && cache[t.id].preview){ start(cache[t.id]).catch(onFail); return; }  // still inside the click
      lookup(t).then(function(info){
        if(TRACKS[idx].id!==t.id || !wantPlay) return;
        return start(info);
      }).catch(onFail);
    }
    function onFail(){
      root.classList.remove('is-buffering'); wantPlay=false;
      setMarquee('no preview for this one - try next');
      say('no preview available');
      syncState();
    }
    function pause(){ wantPlay=false; audio.pause(); }

    function go(step){
      var was = wantPlay || !audio.paused;
      audio.pause(); loadedId=null; audio.removeAttribute('src'); audio.load();
      idx = (idx+step+TRACKS.length)%TRACKS.length;
      localStorage.setItem('mm_aux_track', idx);
      showTrack();
      if(was) play(); else syncState();
    }

    function syncState(){
      var on = !audio.paused;
      root.classList.toggle('is-playing', on);
      playBtn.setAttribute('aria-label', on ? 'pause' : 'play 30-second preview');
      playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      stereo.classList.toggle('on', on);
      sizeMarquee();
      if(on && analyser && !reduceMotion.matches){ if(!raf) raf=requestAnimationFrame(draw); }
    }

    /* the spectrum: 18 bars, winamp's falling peak caps */
    var cx = canvas.getContext('2d'), dpr = Math.max(1, Math.round(window.devicePixelRatio||1));
    var CW = 72, CH = 16, BARS = 18;
    canvas.width = CW*dpr; canvas.height = CH*dpr; cx.scale(dpr,dpr);
    var grad = cx.createLinearGradient(0,CH,0,0);
    grad.addColorStop(0,'#d42a7e'); grad.addColorStop(.55,'#ff7fb6'); grad.addColorStop(1,'#ffe1ee');
    function draw(){
      raf = 0;
      cx.clearRect(0,0,CW,CH);
      var live = !audio.paused && analyser && !reduceMotion.matches;
      if(live) analyser.getByteFrequencyData(bins);
      var any = false;
      for(var i=0;i<BARS;i++){
        // log-spaced bins so the bass doesn't hog the whole display
        var a = Math.floor(Math.pow(i/BARS, 1.6)*80)+1, b = Math.max(a+1, Math.floor(Math.pow((i+1)/BARS,1.6)*80)+1), v=0;
        if(live) for(var k=a;k<b;k++) v = Math.max(v, bins[k]);
        var h = Math.round(v/255*CH);
        peaks[i] = Math.max(h, (peaks[i]||0) - .35);
        if(h){ cx.fillStyle = grad; cx.fillRect(i*4, CH-h, 3, h); }
        if(peaks[i] >= 1){ any = true; cx.fillStyle = '#fff3f8'; cx.fillRect(i*4, CH-Math.round(peaks[i])-1, 3, 1); }
      }
      if(live || any) raf = requestAnimationFrame(draw);
    }

    playBtn.addEventListener('click', function(){ (audio.paused && !root.classList.contains('is-buffering')) ? play() : pause(); });
    prevBtn.addEventListener('click', function(){
      // like winamp: a few seconds in, previous restarts the track
      if(audio.currentTime > 3 && loadedId===TRACKS[idx].id){ audio.currentTime = 0; paintTime(); return; }
      go(-1);
    });
    nextBtn.addEventListener('click', function(){ go(1); });
    timeBtn.addEventListener('click', function(){
      remaining = !remaining;
      timeBtn.setAttribute('aria-label', remaining ? 'showing time remaining' : 'showing time elapsed');
      paintTime();
    });
    seek.addEventListener('input', function(){ if(audio.duration) audio.currentTime = +seek.value; paintTime(); });

    audio.addEventListener('playing', function(){
      root.classList.remove('is-buffering'); say('playing '+TRACKS[idx].song+' by '+TRACKS[idx].artist); syncState();
      document.dispatchEvent(new CustomEvent('mm:audio-play',{detail:audio}));
    });
    // one song at a time: the aux's big player (playlist.html) pauses us when it starts
    document.addEventListener('mm:audio-play', function(e){ if(e.detail!==audio && (wantPlay || !audio.paused)) pause(); });
    audio.addEventListener('pause', syncState);
    audio.addEventListener('loadedmetadata', function(){ seek.max = audio.duration||30; seek.disabled=false; paintTime(); });
    audio.addEventListener('timeupdate', paintTime);
    audio.addEventListener('ended', function(){ go(1); });   // on to the next pick, the way a playlist does
    audio.addEventListener('error', function(){ if(audio.getAttribute('src')) onFail(); });
    reduceMotion.addEventListener && reduceMotion.addEventListener('change', syncState);
    window.addEventListener('pagehide', function(){ audio.pause(); });

    showTrack(); syncState(); draw();
    prefetch(TRACKS.map(function(t){return t.id}));
  })();

  /* ════════════════ MALIBU WEATHER ════════════════ */
  (function(){
    var root = document.querySelector('.mmw'); if(!root) return;
    var $ = function(s){return root.querySelector(s)};
    var URL_ = 'https://api.open-meteo.com/v1/forecast?latitude=34.0259&longitude=-118.7798'
      + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunset'
      + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles&forecast_days=4';

    function kind(code, day){
      if(code<=1) return day ? 'sun' : 'moon';
      if(code===2) return day ? 'part' : 'cloud';
      if(code===3) return 'cloud';
      if(code===45||code===48) return 'fog';
      if(code>=51&&code<=57) return 'drizzle';
      if((code>=61&&code<=67)||(code>=80&&code<=82)) return 'rain';
      if((code>=71&&code<=77)||code===85||code===86) return 'snow';
      if(code>=95) return 'storm';
      return 'cloud';
    }
    var LABEL = {sun:'sunny', moon:'clear', part:'partly cloudy', cloud:'overcast', fog:'fog', drizzle:'drizzle', rain:'rain', snow:'snow', storm:'t-storms'};
    function hm(iso){ // "2026-11-05T16:58" → "4:58 pm" (already malibu time)
      var p = (iso||'').split('T')[1]; if(!p) return '';
      var h = +p.slice(0,2), m = p.slice(3,5);
      return ((h%12)||12)+':'+m+(h<12?' am':' pm');
    }
    function line(k, code, t, sunset){
      if(k==='sun'){
        if(t>=80) return 'beach-hot. keep the cans on ice.';
        if(t>=66) return 'golden hour at '+sunset+'. pour accordingly.';
        return 'crisp and bright: a spritz in the sun, then.';
      }
      if(k==='moon') return 'a clear night on the coast. stay out a little longer.';
      if(k==='part') return 'a few clouds, every one of them flattering.';
      if(k==='cloud') return code===2 ? 'a soft, cloudy night. cardigan weather.' : 'malibu gray. a little pink in the glass helps.';
      if(k==='fog') return 'the marine layer is in. very french new wave.';
      if(k==='drizzle') return 'a soft drizzle, a reason to stay in and sip.';
      if(k==='rain') return 'rain on the canyon: couch, cardigan, spritz.';
      if(k==='snow') return 'snow in malibu? we’ll believe it when we see it.';
      if(k==='storm') return 'thunder over the pacific. very dramatic. very us.';
      return 'perfect for a spritzer.';
    }
    var DAYS = ['sun','mon','tue','wed','thu','fri','sat'];

    function render(d){
      var c = d.current, dl = d.daily, day = c.is_day!==0;
      var t = Math.round(c.temperature_2m), k = kind(c.weather_code, day), sunset = hm(dl.sunset[0]);
      $('.mmw-num').textContent = t;
      $('.mmw-ico').innerHTML = pixelIcon(k);
      $('.mmw-sky').textContent = LABEL[k];
      $('.mmw-hilo').textContent = 'h '+Math.round(dl.temperature_2m_max[0])+'°  l '+Math.round(dl.temperature_2m_min[0])+'°';
      $('.mmw-line').textContent = line(k, c.weather_code, t, sunset);
      root.setAttribute('aria-label', 'malibu weather: '+t+' degrees, '+LABEL[k]);
      var html = '';
      for(var i=1;i<dl.time.length && i<4;i++){
        var dk = kind(dl.weather_code[i], true), dt = new Date(dl.time[i]+'T12:00:00');
        html += '<li><span class="mmw-dn">'+DAYS[dt.getDay()]+'</span>'+pixelIcon(dk)
              + '<span class="mmw-dt">'+Math.round(dl.temperature_2m_max[i])+'°<i>'+Math.round(dl.temperature_2m_min[i])+'°</i></span>'
              + '<span class="mmw-sr">'+LABEL[dk]+'</span></li>';
      }
      $('.mmw-days').innerHTML = html;
      $('.mmw-wind').textContent = 'wind '+Math.round(c.wind_speed_10m)+' mph';
      $('.mmw-hum').textContent = 'humidity '+c.relative_humidity_2m+'%';
      $('.mmw-sun').textContent = 'sunset '+sunset;
      $('.mmw-upd').textContent = 'updated '+hm(c.time);
      root.classList.add('is-live');
    }

    var more = $('.mmw-more'), det = $('.mmw-det');
    more.addEventListener('click', function(){
      var open = more.getAttribute('aria-expanded')!=='true';
      more.setAttribute('aria-expanded', open);
      det.hidden = !open;
      try{ sessionStorage.setItem('mm_wx_open', open?'1':''); }catch(e){}
    });
    if(sessionStorage.getItem('mm_wx_open')){ more.setAttribute('aria-expanded','true'); det.hidden=false; }

    var cached = null;
    try{ cached = JSON.parse(sessionStorage.getItem('mm_wx')||'null'); }catch(e){}
    if(cached && Date.now()-cached.at < 15*60*1000 && cached.d && cached.d.daily){ render(cached.d); return; }
    $('.mmw-ico').innerHTML = pixelIcon('sun');
    fetch(URL_).then(function(r){return r.json()}).then(function(d){
      if(!d || !d.current || !d.daily) return;
      render(d);
      try{ sessionStorage.setItem('mm_wx', JSON.stringify({at:Date.now(), d:d})); }catch(e){}
    }).catch(function(){});
  })();
})();
