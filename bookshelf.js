// Bookshelf: turns the catalogue on bookshelf.html into a 3D shelf.
//
// Every book stands on one line that recedes up and to the right. The open
// book drops out of that line toward the reader, with clearance on both
// sides; the rest pack together by thickness. Positions are unscaled pixels,
// and CSS multiplies them by --book-scale so small screens shrink the shelf.
(function () {
  var shelf = document.querySelector('.js-shelf');
  var stage = shelf && shelf.querySelector('.js-shelf-stage');
  var items = Array.prototype.slice.call(document.querySelectorAll('.c-book'));
  if (!stage || !items.length) return;

  var PX_PER_INCH = 28;
  var PACK = 38;       // space between closed books, on top of their thickness
  var CLEARANCE = 250; // space either side of the open book
  var SLOPE = -0.22;   // rise of the line; a little flatter than the 16deg yaw
  var LINE = 0;        // where the line of closed books crosses the centre
  var DROP = 120;      // how far the open book comes forward
  var DRAG_STEP = 70;  // pointer travel per book while dragging
  var WHEEL_STEP = 60; // horizontal wheel travel per book

  var filtersEl = shelf.querySelector('.js-shelf-filters');
  var prevBtn = shelf.querySelector('.js-shelf-prev');
  var nextBtn = shelf.querySelector('.js-shelf-next');
  var categoryEl = shelf.querySelector('.js-shelf-category');
  var titleEl = shelf.querySelector('.js-shelf-title');
  var authorEl = shelf.querySelector('.js-shelf-author');

  function text(root, selector) {
    var el = root.querySelector(selector);
    return el ? el.textContent.trim() : '';
  }

  var books = items.map(function (item) {
    var dims = (item.getAttribute('data-dims') || '').split(/\s+/).map(Number);
    var group = item.closest('[data-category]');
    return {
      id: item.getAttribute('data-id'),
      item: item,
      title: text(item, '.c-book__title'),
      author: text(item, '.c-book__author'),
      category: group ? group.getAttribute('data-category') : '',
      cover: item.getAttribute('data-cover'),
      width: (dims[0] || 5.5) * PX_PER_INCH,
      height: (dims[1] || 8.25) * PX_PER_INCH,
      depth: (dims[2] || 1) * PX_PER_INCH
    };
  });

  var categories = [];
  books.forEach(function (book) {
    if (book.category && categories.indexOf(book.category) === -1) categories.push(book.category);
  });

  var filter = null; // null shows every category
  var current = books[Math.floor((books.length - 1) / 2)];

  function span(className) {
    var el = document.createElement('span');
    el.className = className;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  // Cover, back board, spine and page block. A book without a cover image,
  // or whose image fails to load, shows its title set in type instead.
  function buildBook(book) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'c-shelf__book';
    el.setAttribute('aria-label', book.title + ', by ' + book.author);
    el.style.setProperty('--width', book.width + 'px');
    el.style.setProperty('--height', book.height + 'px');
    el.style.setProperty('--thickness', book.depth + 'px');

    var cover = document.createElement('span');
    cover.className = 'c-shelf__cover';

    var plate = span('c-shelf__plate');
    plate.innerHTML = '<span class="c-shelf__plate-title"></span><span class="c-shelf__plate-author"></span>';
    plate.firstChild.textContent = book.title;
    plate.lastChild.textContent = book.author;
    cover.appendChild(plate);

    if (book.cover) {
      var img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      img.loading = 'lazy';
      img.addEventListener('error', function () { cover.classList.add('is-missing'); });
      img.src = book.cover;
      cover.appendChild(img);
    } else {
      cover.classList.add('is-missing');
    }

    el.appendChild(span('c-shelf__back'));
    el.appendChild(span('c-shelf__spine'));
    el.appendChild(span('c-shelf__pages'));
    el.appendChild(cover);

    el.addEventListener('click', function () {
      if (suppressClick) return;
      select(book);
    });

    book.el = el;
    return el;
  }

  function visible() {
    return books.filter(function (book) { return !filter || book.category === filter; });
  }

  function render() {
    var list = visible();
    var open = list.indexOf(current);
    var xs = [];
    xs[open] = 0;

    var i;
    for (i = open + 1; i < list.length; i++) {
      xs[i] = xs[i - 1] + (i - 1 === open ? CLEARANCE : PACK) + (list[i - 1].depth + list[i].depth) / 2;
    }
    for (i = open - 1; i >= 0; i--) {
      xs[i] = xs[i + 1] - (i + 1 === open ? CLEARANCE : PACK) - (list[i + 1].depth + list[i].depth) / 2;
    }

    books.forEach(function (book) {
      var el = book.el;
      var index = list.indexOf(book);

      if (index === -1) {
        el.classList.add('is-filtered');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('data-open', 'false');
        el.setAttribute('aria-pressed', 'false');
        el.tabIndex = -1;
        return;
      }

      var isOpen = index === open;
      var x = xs[index];
      el.classList.remove('is-filtered');
      el.removeAttribute('aria-hidden');
      el.style.setProperty('--x', x + 'px');
      el.style.setProperty('--y', (isOpen ? DROP : SLOPE * x + LINE) + 'px');
      // Books further up the line sit behind the ones nearer the reader.
      el.style.zIndex = String(list.length - index);
      el.setAttribute('data-open', isOpen ? 'true' : 'false');
      el.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
      el.tabIndex = isOpen ? 0 : -1;
    });

    categoryEl.textContent = current.category;
    titleEl.textContent = current.title;
    authorEl.textContent = current.author;
    prevBtn.disabled = open <= 0;
    nextBtn.disabled = open >= list.length - 1;

    Array.prototype.forEach.call(filtersEl.children, function (btn) {
      var value = btn.getAttribute('data-category') || null;
      btn.setAttribute('aria-pressed', value === filter ? 'true' : 'false');
    });
  }

  function select(book) {
    if (!book || book === current) return;
    var hadFocus = stage.contains(document.activeElement);
    current = book;
    render();
    if (hadFocus) book.el.focus({ preventScroll: true });
  }

  function step(delta) {
    var list = visible();
    var index = list.indexOf(current) + delta;
    select(list[Math.max(0, Math.min(list.length - 1, index))]);
  }

  function setFilter(value) {
    filter = value;
    var list = visible();
    if (list.indexOf(current) === -1) current = list[Math.floor((list.length - 1) / 2)];
    render();
  }

  // Category filters: "All" plus one per category, each with its count.
  function addFilter(label, value, count) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'c-tabs__item';
    if (value) btn.setAttribute('data-category', value);
    btn.appendChild(document.createTextNode(label + ' '));
    var n = document.createElement('span');
    n.className = 'c-tabs__count';
    n.textContent = count;
    btn.appendChild(n);
    btn.addEventListener('click', function () { setFilter(value); });
    filtersEl.appendChild(btn);
  }

  addFilter('All', null, books.length);
  categories.forEach(function (category) {
    addFilter(category, category, books.filter(function (b) { return b.category === category; }).length);
  });

  // A deep link such as bookshelf.html#conjectures-and-refutations opens that book.
  var linked = books.filter(function (book) { return '#' + book.id === location.hash; })[0];
  if (linked) current = linked;

  // Styles are in place before the books join the page, so nothing animates in.
  var fragment = document.createDocumentFragment();
  books.forEach(function (book) { fragment.appendChild(buildBook(book)); });
  render();
  stage.appendChild(fragment);
  shelf.hidden = false;

  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var active = document.activeElement;
    if (active && active !== document.body && !shelf.contains(active)) return;
    var list = visible();
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Home') select(list[0]);
    else if (e.key === 'End') select(list[list.length - 1]);
    else return;
    e.preventDefault();
  });

  // Sideways wheel and trackpad swipes browse; vertical scrolling is left
  // alone so the page still scrolls past the shelf.
  var wheel = 0;
  var wheelReset;
  stage.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    wheel += e.deltaX;
    if (Math.abs(wheel) >= WHEEL_STEP) {
      step(wheel > 0 ? 1 : -1);
      wheel = 0;
    }
    clearTimeout(wheelReset);
    wheelReset = setTimeout(function () { wheel = 0; }, 200);
  }, { passive: false });

  // Dragging. The pointer is only captured once it has actually moved, so a
  // plain press still lands on the book underneath as a click.
  var drag = null;
  var suppressClick = false;

  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, index: visible().indexOf(current), moved: false };
  });

  stage.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      stage.setPointerCapture(e.pointerId);
      stage.setAttribute('data-dragging', 'true');
    }
    var list = visible();
    var index = drag.index + Math.round(-dx / DRAG_STEP);
    select(list[Math.max(0, Math.min(list.length - 1, index))]);
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
    }
    stage.removeAttribute('data-dragging');
    drag = null;
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // Choosing a book in the catalogue opens it on the shelf.
  books.forEach(function (book) {
    var link = book.item.querySelector('.c-book__title');
    if (!link) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      if (filter && filter !== book.category) filter = null;
      current = null;
      select(book);
      var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      shelf.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    });
  });
})();
