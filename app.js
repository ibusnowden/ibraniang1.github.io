// Theme toggle, mobile navigation, and footnote collection.
(function () {
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // The inline head script sets data-theme first to avoid a flash of the
  // wrong theme; fall back to the stored or system preference.
  var initial = document.documentElement.getAttribute('data-theme');
  if (!initial) {
    try {
      initial = localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) {
      initial = 'light';
    }
  }
  applyTheme(initial);

  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', initial === 'dark' ? 'true' : 'false');
    themeBtn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      themeBtn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // Mobile navigation overlay.
  var navToggle = document.querySelector('.js-nav-toggle');
  var navWrap = document.querySelector('.c-nav-wrap');
  if (navToggle && navWrap) {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.addEventListener('click', function () {
      var open = navWrap.classList.toggle('is-active');
      navToggle.classList.toggle('c-nav-toggle--close', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !navWrap.classList.contains('is-active')) return;
      navWrap.classList.remove('is-active');
      navToggle.classList.remove('c-nav-toggle--close');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Margin notes were part of the old two-column post layout. In a single
  // column they read better as references at the foot of the article, one
  // entry per distinct citation marker.
  var post = document.querySelector('.c-post');
  var content = post && (post.classList.contains('c-content') ? post : post.querySelector('.c-content'));
  if (content) {
    var notes = Array.prototype.slice.call(content.querySelectorAll('.sidenote'));
    if (notes.length) {
      var seen = {};
      var entries = [];

      notes.forEach(function (note) {
        var marker = note.previousElementSibling;
        if (!marker || !marker.classList.contains('cite')) return;
        var label = (marker.textContent || '').replace(/[^0-9]/g, '') || String(entries.length + 1);
        if (!seen[label]) {
          seen[label] = true;
          entries.push({ label: label, html: note.innerHTML });
        }
        marker.setAttribute('href', '#ref-' + label);
      });

      if (entries.length) {
        entries.sort(function (a, b) { return Number(a.label) - Number(b.label); });

        var heading = document.createElement('h2');
        heading.id = 'references';
        heading.textContent = 'References';

        var list = document.createElement('ul');
        list.className = 'o-plain-list c-refs';
        entries.forEach(function (entry) {
          var li = document.createElement('li');
          li.id = 'ref-' + entry.label;
          li.innerHTML = entry.html;
          list.appendChild(li);
        });

        content.appendChild(heading);
        content.appendChild(list);
      }
    }
  }
})();
