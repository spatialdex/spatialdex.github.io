// Real-robot and comparison clips get custom controls; the rest are plain looping clips.
var CONTROLLED = '.var-grid .clip, .cmp-grid .clip';

function loadClip(v) {
  if (!v.src && v.dataset.src) v.src = v.dataset.src;
}

// Real-world task bar: jump links pinned while the tasks are on screen; the task
// under the bar is highlighted. After a click, wait for the scroll to settle.
(function () {
  var nav = document.querySelector('.task-nav');
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
  var tasks = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var current = -1, ticking = false, lock = false, idle = 0;

  function mark(i) {
    if (i === current) return;
    current = i;
    links.forEach(function (a, j) {
      if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    var a = links[i];
    nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
  }
  function update() {
    ticking = false;
    var line = nav.getBoundingClientRect().bottom + 40, i = 0;
    tasks.forEach(function (t, j) { if (t.getBoundingClientRect().top <= line) i = j; });
    mark(i);
  }
  function release(ms) {
    clearTimeout(idle);
    idle = setTimeout(function () { lock = false; update(); }, ms);
  }

  window.addEventListener('scroll', function () {
    if (lock) return release(150);
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  links.forEach(function (a, i) {
    a.addEventListener('click', function () { mark(i); lock = true; release(1000); });
  });
  update();
})();

// Lazy-load muted clips and play them only while on screen.
// A clip the viewer paused (data-hold) stays paused when it scrolls back into view.
(function () {
  var clips = document.querySelectorAll('video.lazy');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    clips.forEach(function (v) {
      loadClip(v);
      if (!reduceMotion) v.play().catch(function () {});
      else if (!v.closest(CONTROLLED)) v.controls = true;
    });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        loadClip(v);
        if (!v.dataset.hold) v.play().catch(function () {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { rootMargin: '200px 0px', threshold: 0.15 });

  clips.forEach(function (v) { io.observe(v); });
})();

// Play/pause, seek bar, time and full screen for the real-robot clips (no audio).
(function () {
  var ICON_PLAY = '<svg class="i-play" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
  var ICON_PAUSE = '<svg class="i-pause" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
  var ICON_FS = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

  function fmt(t) {
    t = Math.max(0, Math.floor(t || 0));
    var s = t % 60;
    return Math.floor(t / 60) + ':' + (s < 10 ? '0' : '') + s;
  }

  document.querySelectorAll(CONTROLLED).forEach(function (clip) {
    var v = clip.querySelector('video');
    if (!v) return;
    clip.classList.add('ctl', 'paused');

    var bar = document.createElement('div');
    bar.className = 'vc';
    bar.innerHTML =
      '<button type="button" class="vc-play" aria-label="Play">' + ICON_PLAY + ICON_PAUSE + '</button>' +
      '<input class="vc-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Seek">' +
      '<span class="vc-time">0:00 / 0:00</span>' +
      '<button type="button" class="vc-fs" aria-label="Full screen">' + ICON_FS + '</button>';
    clip.appendChild(bar);

    var btn = bar.querySelector('.vc-play');
    var seek = bar.querySelector('.vc-seek');
    var time = bar.querySelector('.vc-time');
    var dragging = false, raf = 0;

    function sync() {
      var d = v.duration;
      if (!isFinite(d) || d <= 0) return;
      var p = v.currentTime / d;
      if (!dragging) seek.value = Math.round(p * 1000);
      seek.style.setProperty('--p', (seek.value / 10) + '%');
      time.textContent = fmt(v.currentTime) + ' / ' + fmt(d);
      seek.setAttribute('aria-valuetext', time.textContent);
    }
    function tick() {
      sync();
      if (!v.paused) raf = requestAnimationFrame(tick);
    }
    function toggle() {
      loadClip(v);
      if (v.paused) {
        delete v.dataset.hold;
        v.play().catch(function () {});
      } else {
        v.dataset.hold = '1';
        v.pause();
      }
    }

    v.addEventListener('play', function () {
      clip.classList.remove('paused');
      btn.setAttribute('aria-label', 'Pause');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    });
    v.addEventListener('pause', function () {
      clip.classList.add('paused');
      btn.setAttribute('aria-label', 'Play');
      cancelAnimationFrame(raf);
      sync();
    });
    v.addEventListener('loadedmetadata', sync);
    v.addEventListener('seeked', sync);

    btn.addEventListener('click', toggle);
    v.addEventListener('click', toggle);

    seek.addEventListener('pointerdown', function () { dragging = true; });
    seek.addEventListener('input', function () {
      loadClip(v);
      var d = v.duration;
      seek.style.setProperty('--p', (seek.value / 10) + '%');
      if (isFinite(d) && d > 0) {
        v.currentTime = seek.value / 1000 * d;
        time.textContent = fmt(v.currentTime) + ' / ' + fmt(d);
      }
    });
    seek.addEventListener('change', function () { dragging = false; sync(); });
    seek.addEventListener('pointerup', function () { dragging = false; });

    bar.querySelector('.vc-fs').addEventListener('click', function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else if (clip.requestFullscreen) {
        clip.requestFullscreen().catch(function () {});
      } else if (clip.webkitRequestFullscreen) {
        clip.webkitRequestFullscreen();
      } else if (v.webkitEnterFullscreen) {
        loadClip(v);
        v.webkitEnterFullscreen();
      }
    });
  });
})();

// Per-task tooltip on bar charts. Each .bars[data-tasks] lists its task names ("A|B|C");
// each row's data-v holds the per-task values.
(function () {
  var tip = document.getElementById('bar-tip');
  var rows = document.querySelectorAll('.bars[data-tasks] .bar-row');
  if (!tip || !rows.length) return;

  function fill(row) {
    var chart = row.closest('.bars');
    var tasks = chart.dataset.tasks.split('|');
    var vals = row.dataset.v.split(',');
    var html = '<div class="t">' + row.querySelector('.name').textContent + '</div>';
    tasks.forEach(function (t, i) {
      html += '<div class="r"><span>' + t + '</span><span>' + vals[i] + '</span></div>';
    });
    tip.innerHTML = html;
  }
  function place(x, y) {
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = Math.min(x + 14, window.innerWidth - w - 8);
    var top = y + 14 + h > window.innerHeight ? y - h - 14 : y + 14;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hide() { tip.classList.remove('show'); }

  rows.forEach(function (row) {
    row.addEventListener('mouseenter', function () { fill(row); tip.classList.add('show'); });
    row.addEventListener('mousemove', function (e) { place(e.clientX, e.clientY); });
    row.addEventListener('mouseleave', hide);
    row.addEventListener('focus', function () {
      fill(row); tip.classList.add('show');
      var r = row.getBoundingClientRect();
      place(r.left + r.width * 0.6, r.bottom - 6);
    });
    row.addEventListener('blur', hide);
  });
  window.addEventListener('scroll', hide, { passive: true });
})();

// Respect reduced-motion for the hero video.
(function () {
  var hero = document.querySelector('.hero-video');
  if (hero && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.removeAttribute('autoplay');
    hero.pause();
  }
})();
