(function () {
  var stage = document.getElementById('stage');
  function fit() {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var repo = 'https://github.com/twl-Benchen/etf-wiki/blob/main/';
  var paths = document.getElementById('paths');
  var counter = document.getElementById('counter');
  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  var bar = document.getElementById('progress');
  var i = 0;

  function sourceHtml(s) {
    var src = (s.getAttribute('data-source') || '').trim();
    if (!src) return '結構頁，無事實內容';
    return '資料來源: ' + src.split(/\s+/).map(function (p) {
      return '<a href="' + repo + p + '" target="_blank" rel="noopener">' + p + '</a>';
    }).join('、');
  }

  function show(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, k) { s.classList.toggle('active', k === i); });
    paths.innerHTML = sourceHtml(slides[i]);
    counter.textContent = (i + 1) + ' / ' + slides.length;
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    bar.style.width = ((i + 1) / slides.length * 100) + '%';
    if (history.replaceState) history.replaceState(null, '', '#' + (i + 1));
  }

  prev.addEventListener('click', function () { show(i - 1); });
  next.addEventListener('click', function () { show(i + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); show(i + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(i - 1); }
    if (e.key === 'Home') show(0);
    if (e.key === 'End') show(slides.length - 1);
  });
  var x0 = null, y0 = null;
  document.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  var start = parseInt(location.hash.replace('#', ''), 10);
  show(isNaN(start) ? 0 : start - 1);
})();
