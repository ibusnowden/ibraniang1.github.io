// Making Physics — interaction layer
// scroll-reveal, KaTeX equations, reading progress, sticky track pills,
// image lightbox, back-to-top. All progressive enhancement; degrades gracefully.
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── KaTeX: render every .eq-tex from its text content ──────────────
  function renderMath() {
    if (typeof katex === "undefined") return;
    document.querySelectorAll(".eq-tex").forEach(function (el) {
      if (el.dataset.done) return;
      try {
        katex.render(el.textContent, el, {
          displayMode: true, throwOnError: false, output: "html"
        });
        el.dataset.done = "1";
      } catch (e) { /* leave the raw TeX visible on failure */ }
    });
  }
  if (document.querySelector(".eq-tex")) {
    if (typeof katex !== "undefined") renderMath();
    else window.addEventListener("load", renderMath);
    // katex.min.js is deferred; also try once more after a tick
    document.addEventListener("DOMContentLoaded", function () { setTimeout(renderMath, 0); });
  }

  // ── scroll reveal ──────────────────────────────────────────────────
  var reveals = document.querySelectorAll(".reveal, .card");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el, i) {
      // small stagger for cards within a grid row
      if (el.classList.contains("card")) el.style.setProperty("--d", (i % 3) * 60 + "ms");
      io.observe(el);
    });
  }

  // ── reading progress bar (article pages) ───────────────────────────
  var bar = document.getElementById("progress");
  if (bar) {
    var tick = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
      bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, p)) + ")";
    };
    document.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    tick();
  }

  // ── sticky track pills: highlight the visible chapter group ────────
  var pills = document.getElementById("pills");
  if (pills) {
    var links = {};
    pills.querySelectorAll("a[data-pill]").forEach(function (a) { links[a.dataset.pill] = a; });
    var groups = document.querySelectorAll(".chapter-group");
    if ("IntersectionObserver" in window && groups.length) {
      var pio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && links[e.target.id]) {
            Object.keys(links).forEach(function (k) { links[k].classList.remove("on"); });
            links[e.target.id].classList.add("on");
          }
        });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      groups.forEach(function (g) { pio.observe(g); });
    }
  }

  // ── lightbox / image zoom ──────────────────────────────────────────
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbImg = lb.querySelector("img");
    document.querySelectorAll("img.zoomable").forEach(function (img) {
      img.addEventListener("click", function () {
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt || "";
        lb.classList.add("open");
        lb.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      });
    });
    var close = function () {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    };
    lb.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  // ── sidebar TOC: mobile drawer toggle ─────────────────────────────
  var tocToggle = document.getElementById("tocToggle");
  var toc = document.getElementById("toc");
  if (tocToggle && toc) {
    tocToggle.addEventListener("click", function () {
      var open = toc.classList.toggle("open");
      tocToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // tapping a chapter/section link closes the drawer on mobile
    toc.addEventListener("click", function (e) {
      if (e.target.closest("a") && window.matchMedia("(max-width:960px)").matches) {
        toc.classList.remove("open");
        tocToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ── sidebar scroll-spy: light the section you're reading ───────────
  var subLinks = toc ? toc.querySelectorAll(".toc-sub") : [];
  if (subLinks.length && "IntersectionObserver" in window) {
    var subMap = {};
    subLinks.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      if (id) subMap[id] = a;
    });
    var current = null;
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (current) current.classList.remove("active");
          current = subMap[e.target.id];
          if (current) current.classList.add("active");
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });
    Object.keys(subMap).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) sio.observe(sec);
    });
  }

  // ── back to top ────────────────────────────────────────────────────
  var top = document.getElementById("totop");
  if (top) {
    document.addEventListener("scroll", function () {
      top.classList.toggle("show", window.scrollY > 600);
    }, { passive: true });
    top.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }
})();
