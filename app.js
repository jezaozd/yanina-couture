(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // кадр: requestAnimationFrame, а если он не пришёл (фоновая вкладка, встроенные окна) — таймер
  var raf = function (f) {
    var fired = false;
    var g = function () { if (!fired) { fired = true; f(); } };
    if (window.requestAnimationFrame) window.requestAnimationFrame(g);
    setTimeout(g, 60);
  };
  var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var DOTS = window.DOTS || {};

  /* ---------- точки: раскладка под object-fit: cover ---------- */
  function layout(set, w, h, px, py) {
    var dh = Math.max(h, w / set.a), dw = dh * set.a;
    var ox = (w - dw) * px, oy = (h - dh) * py;
    var rings = set.r.map(function (r) {
      var pts = [];
      for (var i = 0; i < r.length; i += 2) pts.push([ox + r[i] * dw, oy + r[i + 1] * dh]);
      return pts;
    });
    // прокалываем сверху вниз, кольцо за кольцом
    rings.sort(function (a, b) { return a[0][1] - b[0][1]; });
    var flat = [];
    rings.forEach(function (r) { r.forEach(function (p) { flat.push(p); }); });
    return { flat: flat, scale: dw / 760 };
  }

  function fit(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  var STYLE = {
    // прокол в кальке: тёмная дырочка с синим следом порошка
    holes: function (ctx, p, s) {
      var r = Math.max(1, 1.25 * s);
      ctx.fillStyle = 'rgba(35,53,196,.28)';
      ctx.beginPath(); ctx.arc(p[0] + .5, p[1] + .6, r * 1.7, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(16,22,74,.88)';
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
    },
    // порошок на ткани: размытая синяя точка
    powder: function (ctx, p, s) {
      var r = Math.max(1.1, 1.7 * s);
      ctx.fillStyle = 'rgba(70,92,255,.22)';
      ctx.beginPath(); ctx.arc(p[0], p[1], r * 2.1, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(92,114,255,.95)';
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
    },
    // порошок на фото лифа (смешивается умножением)
    dust: function (ctx, p, s) {
      var r = Math.max(1.1, 1.6 * s);
      ctx.fillStyle = 'rgba(35,53,196,.25)';
      ctx.beginPath(); ctx.arc(p[0], p[1], r * 2.2, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(35,53,196,.9)';
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
    }
  };

  // рисует точки; при dur > 0 — по очереди, как идёт игла
  function prick(cv, set, style, px, py, dur, done) {
    var c = fit(cv);
    if (!c.w || !c.h) return function () {};
    var L = layout(set, c.w, c.h, px, py);
    var s = clamp(L.scale, .7, 1.6);
    var n = L.flat.length, drawn = 0, t0 = now(), stopped = false;
    var paint = STYLE[style];
    function upto(k) {
      for (; drawn < k; drawn++) paint(c.ctx, L.flat[drawn], s);
    }
    if (!dur || calm) { upto(n); if (done) done(); return function () {}; }
    (function step() {
      if (stopped) return;
      var k = Math.round(n * clamp((now() - t0) / dur, 0, 1));
      upto(k);
      if (drawn < n) raf(step); else if (done) done();
    })();
    return function finish() { if (!stopped) { stopped = true; upto(n); if (done) done(); } };
  }

  /* ---------- 1. калька над лифом ---------- */
  var hero = $('.hero'), kalka = $('#kalka'), holes = $('#holes'), powder = $('#powder');
  var phases = $$('.phase li'), hbar = $('#hbar');
  var finishPrick = null, dustReady = false, lastPhase = 0;

  function drawHero(animate) {
    if (!DOTS.blossom || !holes) return;
    finishPrick = prick(holes, DOTS.blossom, 'holes', .5, .4, animate ? 2600 : 0, null);
    prick(powder, DOTS.blossom, 'dust', .5, .4, 0, function () { dustReady = true; });
  }

  function heroScroll() {
    if (!hero) return;
    var r = hero.getBoundingClientRect();
    var span = hero.offsetHeight - window.innerHeight;
    var p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
    if (p > .02 && finishPrick) { finishPrick(); finishPrick = null; }
    var lift = smooth(.06, .6, p);
    kalka.style.transform = 'translate(' + (lift * 12) + '%,' + (-lift * 112) + '%) rotate(' + (lift * 7) + 'deg)';
    kalka.style.opacity = String(1 - smooth(.45, .62, p) * .9);
    if (dustReady) powder.style.opacity = String(Math.min(1, lift * 1.5) * (1 - smooth(.72, .98, p) * .8));
    var ph = p < .2 ? 0 : p < .62 ? 1 : 2;
    if (ph !== lastPhase) {
      phases.forEach(function (li, i) { li.classList.toggle('on', i === ph); });
      lastPhase = ph;
    }
    if (hbar) hbar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
  }

  /* ---------- 2. три стадии одного узора ---------- */
  var layers = $$('canvas[data-dots]');
  function drawLayer(cv, animate) {
    var set = DOTS[cv.dataset.dots];
    if (!set) return;
    prick(cv, set, cv.dataset.style, .5, .5, animate ? 2200 : 0, null);
    cv.dataset.done = 1;
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !e.target.dataset.done) { drawLayer(e.target, true); io.unobserve(e.target); }
      });
    }, { threshold: .35 });
    layers.forEach(function (cv) { io.observe(cv); });
  } else {
    layers.forEach(function (cv) { drawLayer(cv, false); });
  }

  /* ---------- 3. лента коллекции ---------- */
  var rail = $('#rail'), prev = $('#prev'), next = $('#next'), count = $('#count');
  var looks = $$('.look', rail);
  function current() {
    var x = rail.scrollLeft, best = 0;
    looks.forEach(function (l, i) { if (l.offsetLeft - rail.offsetLeft - 40 <= x) best = i; });
    return best;
  }
  function syncRail() {
    var i = current();
    count.textContent = (i + 1) + ' / ' + looks.length;
    prev.disabled = rail.scrollLeft < 8;
    next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
  }
  function go(d) {
    var i = clamp(current() + d, 0, looks.length - 1);
    rail.scrollTo({ left: looks[i].offsetLeft - rail.offsetLeft - parseFloat(getComputedStyle(rail).paddingLeft), behavior: calm ? 'auto' : 'smooth' });
  }
  if (rail) {
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    rail.addEventListener('scroll', function () { raf(syncRail); }, { passive: true });
    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    // перетаскивание мышью
    var down = null;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = { x: e.clientX, l: rail.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      if (Math.abs(dx) > 4) { down.moved = true; rail.classList.add('drag'); }
      if (down.moved) rail.scrollLeft = down.l - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      var moved = down.moved; down = null; rail.classList.remove('drag');
      if (moved) go(0);
    });
    syncRail();
  }

  /* ---------- 5. линия времени прокалывается по мере чтения ---------- */
  var tl = $('#tl');
  function tlScroll() {
    if (!tl || calm) return;
    var r = tl.getBoundingClientRect();
    var p = clamp((window.innerHeight * .8 - r.top) / r.height, 0, 1);
    tl.style.setProperty('--tl', p.toFixed(3));
  }

  /* ---------- 6. заявка письмом ---------- */
  var form = $('#form'), ferr = $('#ferr');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements, bad = null;
      ['contact', 'name'].forEach(function (k) {
        var ok = f[k].value.trim().length > 1;
        f[k].setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok) bad = f[k];
      });
      if (bad) {
        ferr.textContent = bad.name === 'name'
          ? 'Напишите, как к вам обращаться, — так дом сможет ответить лично.'
          : 'Оставьте телефон или Telegram, иначе дому некуда ответить.';
        bad.focus();
        return;
      }
      ferr.textContent = '';
      var val = function (n) { var el = form.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : ''; };
      var body = [
        'Здравствуйте! Хочу заказать платье YANINA Couture.',
        '',
        'Имя: ' + f.name.value.trim(),
        'Связаться: ' + f.contact.value.trim(),
        'Повод: ' + val('occasion'),
        'Когда нужно: ' + (f.when.value.trim() || 'пока не знаю'),
        'Примерка: ' + val('city')
      ].join('\n');
      window.location.href = 'mailto:info@yaninacouture.com?subject=' +
        encodeURIComponent('Заказ платья: ' + val('occasion')) + '&body=' + encodeURIComponent(body);
    });
    $$('input[required]', form).forEach(function (el) {
      el.addEventListener('input', function () { if (el.value.trim().length > 1) { el.setAttribute('aria-invalid', 'false'); ferr.textContent = ''; } });
    });
  }

  /* ---------- запуск ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    raf(function () { ticking = false; heroScroll(); tlScroll(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  var rz = null, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (Math.abs(window.innerWidth - lastW) < 2 && window.innerWidth < 900) { heroScroll(); return; } // мобильная адресная строка
      lastW = window.innerWidth;
      drawHero(false);
      layers.forEach(function (cv) { if (cv.dataset.done) drawLayer(cv, false); });
      heroScroll(); tlScroll();
    }, 160);
  });

  function start() { drawHero(true); heroScroll(); tlScroll(); }
  var img = $('.sheet-photo');
  if (img && !img.complete) img.addEventListener('load', start, { once: true }); else start();
})();
