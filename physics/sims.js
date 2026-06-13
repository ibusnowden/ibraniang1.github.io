// Making Physics — interactive explainers (vanilla JS, no deps, no build).
// Each <div class="sim" data-sim="KEY"> is mounted with a live canvas simulation
// that runs the same physics as the C++ labs: RK4, velocity-Verlet, Metropolis.
(function () {
  "use strict";
  var INK = "#16171d", BLUE = "#2f49e0", GOLD = "#f0ad3f",
      LINE = "#d9d2c4", PAPER = "#fbf9f4", SOFT = "#7c766a";
  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── tiny DOM helpers ───────────────────────────────────────────────
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function shell(container, height) {
    container.classList.add("sim-built");
    var stage = el("div", "sim-stage");
    var canvas = el("canvas", "sim-canvas");
    canvas.style.height = height + "px";
    stage.appendChild(canvas);
    var panel = el("div", "sim-panel");
    container.appendChild(stage);
    container.appendChild(panel);
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0;
    function fit() {
      var r = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = r.width; H = r.height;
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);
    else window.addEventListener("resize", fit);
    return { canvas: canvas, ctx: ctx, panel: panel, get W() { return W; }, get H() { return H; }, fit: fit };
  }

  function slider(panel, o) {
    var wrap = el("div", "sim-ctrl");
    var lab = el("label", "sim-lab");
    var nm = el("span", null, o.label);
    var vv = el("span", "sim-val");
    var inp = el("input"); inp.type = "range";
    inp.min = o.min; inp.max = o.max; inp.step = o.step; inp.value = o.value;
    function show() { vv.textContent = (o.fmt ? o.fmt(+inp.value) : +inp.value) + (o.unit || ""); }
    inp.addEventListener("input", function () { show(); o.on(+inp.value); });
    show();
    lab.appendChild(nm); lab.appendChild(vv);
    wrap.appendChild(lab); wrap.appendChild(inp);
    panel.appendChild(wrap);
    return { input: inp, set: function (v) { inp.value = v; show(); } };
  }

  function button(panel, label, on, primary) {
    var b = el("button", "sim-btn" + (primary ? " primary" : ""), label);
    b.type = "button";
    b.addEventListener("click", on);
    panel.appendChild(b);
    return b;
  }

  function segmented(panel, label, opts, value, on) {
    var wrap = el("div", "sim-ctrl");
    wrap.appendChild(el("label", "sim-lab", label));
    var seg = el("div", "sim-seg");
    var btns = [];
    opts.forEach(function (op) {
      var b = el("button", "sim-seg-b" + (op.v === value ? " on" : ""), op.t);
      b.type = "button";
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on"); on(op.v);
      });
      seg.appendChild(b); btns.push(b);
    });
    wrap.appendChild(seg); panel.appendChild(wrap);
  }

  function readout(panel, label) {
    var wrap = el("div", "sim-read");
    wrap.appendChild(el("span", "sim-read-k", label));
    var v = el("span", "sim-read-v"); wrap.appendChild(v);
    panel.appendChild(wrap);
    return function (t) { v.textContent = t; };
  }

  // play/pause helper bound to a sim's running flag
  function playBtn(panel, sim) {
    var b = button(panel, sim.running ? "Pause" : "Play", function () {
      sim.running = !sim.running;
      b.textContent = sim.running ? "Pause" : "Play";
      if (sim.running) sim.kick();
    }, true);
    sim._playBtn = b;
    return b;
  }

  function loop(sim, step) {
    var last = 0;
    function frame(ts) {
      if (!sim.running) { sim._raf = 0; return; }
      var dt = last ? Math.min((ts - last) / 1000, 1 / 30) : 1 / 60;
      last = ts;
      step(dt);
      sim._raf = requestAnimationFrame(frame);
    }
    sim.kick = function () { if (!sim._raf) { last = 0; sim._raf = requestAnimationFrame(frame); } };
    sim.kick();
  }

  function clear(s, bg) { s.ctx.fillStyle = bg || PAPER; s.ctx.fillRect(0, 0, s.W, s.H); }

  // ===================================================================
  // PROJECTILE
  // ===================================================================
  function projectile(c) {
    var s = shell(c, 300);
    var v0 = 26, ang = 52, drag = 0.0, g = 9.81;
    var path = [], T = 0, simT = 0;
    var sim = { running: !REDUCE, _raf: 0 };

    function accel(st) {
      var sp = Math.hypot(st[2], st[3]);
      return [-drag * sp * st[2], -g - drag * sp * st[3]];
    }
    function rk4(st, h) {
      var a1 = accel(st);
      var k1 = [st[2], st[3], a1[0], a1[1]];
      var s2 = [st[0] + k1[0] * h / 2, st[1] + k1[1] * h / 2, st[2] + k1[2] * h / 2, st[3] + k1[3] * h / 2];
      var a2 = accel(s2); var k2 = [s2[2], s2[3], a2[0], a2[1]];
      var s3 = [st[0] + k2[0] * h / 2, st[1] + k2[1] * h / 2, st[2] + k2[2] * h / 2, st[3] + k2[3] * h / 2];
      var a3 = accel(s3); var k3 = [s3[2], s3[3], a3[0], a3[1]];
      var s4 = [st[0] + k3[0] * h, st[1] + k3[1] * h, st[2] + k3[2] * h, st[3] + k3[3] * h];
      var a4 = accel(s4); var k4 = [s4[2], s4[3], a4[0], a4[1]];
      for (var i = 0; i < 4; i++) st[i] += h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6;
    }
    function build() {
      var r = ang * Math.PI / 180;
      var st = [0, 0, v0 * Math.cos(r), v0 * Math.sin(r)];
      var h = 0.004, t = 0; path = [];
      path.push({ x: 0, y: 0, t: 0 });
      while (t < 30) {
        rk4(st, h); t += h;
        path.push({ x: st[0], y: Math.max(0, st[1]), t: t });
        if (st[1] <= 0) break;
      }
      T = t; simT = 0;
    }
    build();

    var rRange = readout(s.panel, "range");
    var rApex = readout(s.panel, "apex");
    slider(s.panel, { label: "speed", min: 8, max: 42, step: 1, value: v0, unit: " m/s", on: function (v) { v0 = v; build(); } });
    slider(s.panel, { label: "angle", min: 10, max: 85, step: 1, value: ang, unit: "°", on: function (v) { ang = v; build(); } });
    slider(s.panel, { label: "drag", min: 0, max: 0.06, step: 0.002, value: drag, fmt: function (x) { return x.toFixed(3); }, on: function (v) { drag = v; build(); } });
    playBtn(s.panel, sim);

    loop(sim, function (dt) {
      simT += dt;
      if (simT > T + 0.7) simT = 0;
      // bounds
      var maxX = 0, maxY = 0;
      for (var i = 0; i < path.length; i++) { if (path[i].x > maxX) maxX = path[i].x; if (path[i].y > maxY) maxY = path[i].y; }
      maxX = Math.max(maxX, 1); maxY = Math.max(maxY, 1);
      var padL = 34, padR = 18, padT = 22, padB = 30;
      var sx = (s.W - padL - padR) / maxX;
      var sy = (s.H - padT - padB) / maxY;
      var k = Math.min(sx, sy);
      function px(p) { return padL + p.x * k; }
      function py(p) { return s.H - padB - p.y * k; }
      clear(s);
      // ground
      s.ctx.strokeStyle = LINE; s.ctx.lineWidth = 1;
      s.ctx.beginPath(); s.ctx.moveTo(0, s.H - padB); s.ctx.lineTo(s.W, s.H - padB); s.ctx.stroke();
      // full arc
      s.ctx.strokeStyle = "rgba(47,73,224,0.28)"; s.ctx.lineWidth = 2;
      s.ctx.beginPath();
      for (var j = 0; j < path.length; j++) { var X = px(path[j]), Y = py(path[j]); j ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); }
      s.ctx.stroke();
      // marker (interp by time)
      var idx = 0; while (idx < path.length - 1 && path[idx].t < Math.min(simT, T)) idx++;
      var p = path[idx];
      var mx = px(p), my = py(p);
      // traced portion
      s.ctx.strokeStyle = BLUE; s.ctx.lineWidth = 2.6;
      s.ctx.beginPath();
      for (var m = 0; m <= idx; m++) { var X2 = px(path[m]), Y2 = py(path[m]); m ? s.ctx.lineTo(X2, Y2) : s.ctx.moveTo(X2, Y2); }
      s.ctx.stroke();
      s.ctx.fillStyle = GOLD;
      s.ctx.beginPath(); s.ctx.arc(mx, my, 6, 0, 7); s.ctx.fill();
      s.ctx.strokeStyle = INK; s.ctx.lineWidth = 1.4; s.ctx.stroke();
      rRange("≈ " + maxX.toFixed(1) + " m");
      rApex("≈ " + maxY.toFixed(1) + " m");
    });
  }

  // ===================================================================
  // PENDULUM  (nonlinear vs small-angle ghost)
  // ===================================================================
  function pendulum(c) {
    var s = shell(c, 320);
    var L = 1.1, g = 9.81;
    var th = 1.05, om = 0;          // nonlinear
    var thL = 1.05, omL = 0;        // small-angle ghost
    var dragging = false;
    var sim = { running: !REDUCE, _raf: 0 };

    var rPer = readout(s.panel, "period");
    var rAmp = readout(s.panel, "amplitude");
    slider(s.panel, { label: "length", min: 0.4, max: 2.0, step: 0.05, value: L, unit: " m", fmt: function (x) { return x.toFixed(2); }, on: function (v) { L = v; } });
    slider(s.panel, { label: "gravity", min: 1, max: 20, step: 0.5, value: g, unit: " m/s²", fmt: function (x) { return x.toFixed(1); }, on: function (v) { g = v; } });
    button(s.panel, "Reset", function () { th = thL = 1.05; om = omL = 0; });
    playBtn(s.panel, sim);

    function pivot() { return { x: s.W / 2, y: s.H * 0.16 }; }
    function bobLen() { return Math.min(s.H * 0.62, s.W * 0.42) * (L / 2.0) + 28; }

    function setFromPointer(ev) {
      var r = s.canvas.getBoundingClientRect();
      var p = pivot();
      var dx = (ev.clientX - r.left) - p.x, dy = (ev.clientY - r.top) - p.y;
      th = thL = Math.atan2(dx, dy);   // angle from downward vertical
      om = omL = 0;
    }
    s.canvas.addEventListener("pointerdown", function (e) { dragging = true; setFromPointer(e); s.canvas.setPointerCapture(e.pointerId); });
    s.canvas.addEventListener("pointermove", function (e) { if (dragging) setFromPointer(e); });
    s.canvas.addEventListener("pointerup", function () { dragging = false; });
    s.canvas.style.cursor = "grab";

    loop(sim, function (dt) {
      var steps = 6, h = dt / steps;
      if (!dragging) {
        for (var i = 0; i < steps; i++) {
          // RK4 nonlinear
          var f = function (t, w) { return [w, -(g / L) * Math.sin(t)]; };
          var k1 = f(th, om);
          var k2 = f(th + k1[0] * h / 2, om + k1[1] * h / 2);
          var k3 = f(th + k2[0] * h / 2, om + k2[1] * h / 2);
          var k4 = f(th + k3[0] * h, om + k3[1] * h);
          th += h * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
          om += h * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
          // small-angle ghost (linear)
          var aL = -(g / L) * thL;
          omL += aL * h; thL += omL * h;
        }
      }
      var p = pivot(), Lp = bobLen();
      var bx = p.x + Lp * Math.sin(th), by = p.y + Lp * Math.cos(th);
      var gx = p.x + Lp * Math.sin(thL), gy = p.y + Lp * Math.cos(thL);
      clear(s);
      // arc guide
      s.ctx.strokeStyle = "rgba(22,23,29,0.08)"; s.ctx.lineWidth = 1;
      s.ctx.beginPath(); s.ctx.arc(p.x, p.y, Lp, 0.15 * Math.PI, 0.85 * Math.PI); s.ctx.stroke();
      // ghost (small angle)
      s.ctx.strokeStyle = "rgba(240,173,63,0.55)"; s.ctx.lineWidth = 2;
      s.ctx.beginPath(); s.ctx.moveTo(p.x, p.y); s.ctx.lineTo(gx, gy); s.ctx.stroke();
      s.ctx.fillStyle = "rgba(240,173,63,0.7)"; s.ctx.beginPath(); s.ctx.arc(gx, gy, 9, 0, 7); s.ctx.fill();
      // nonlinear
      s.ctx.strokeStyle = INK; s.ctx.lineWidth = 2.4;
      s.ctx.beginPath(); s.ctx.moveTo(p.x, p.y); s.ctx.lineTo(bx, by); s.ctx.stroke();
      s.ctx.fillStyle = BLUE; s.ctx.beginPath(); s.ctx.arc(bx, by, 13, 0, 7); s.ctx.fill();
      s.ctx.strokeStyle = INK; s.ctx.lineWidth = 1.5; s.ctx.stroke();
      // pivot
      s.ctx.fillStyle = INK; s.ctx.beginPath(); s.ctx.arc(p.x, p.y, 4, 0, 7); s.ctx.fill();
      var amp = Math.abs(th);
      var Tn = 2 * Math.PI * Math.sqrt(L / g) * (1 + amp * amp / 16);
      rPer("≈ " + Tn.toFixed(2) + " s");
      rAmp((amp * 180 / Math.PI).toFixed(0) + "°");
    });
  }

  // ===================================================================
  // ORBIT  (Euler vs Verlet, drag to launch)
  // ===================================================================
  function orbit(c) {
    var s = shell(c, 360);
    var mu = 1.0, SC = 120;        // world->px scale
    var method = "verlet";
    var pos = [1.0, 0], vel = [0, 1.0];
    var trail = [], aiming = false, aimV = null;
    var sim = { running: !REDUCE, _raf: 0 };

    function center() { return { x: s.W / 2, y: s.H / 2 }; }
    function W2P(p) { var c0 = center(); return { x: c0.x + p[0] * SC, y: c0.y - p[1] * SC }; }
    function accel(p) { var r = Math.hypot(p[0], p[1]); var r3 = Math.max(r * r * r, 1e-4); return [-mu * p[0] / r3, -mu * p[1] / r3]; }
    function reset() { pos = [1.0, 0]; vel = [0, 1.0]; trail = []; }

    var rE = readout(s.panel, "energy");
    var rState = readout(s.panel, "orbit");
    segmented(s.panel, "integrator", [{ t: "Euler", v: "euler" }, { t: "Verlet", v: "verlet" }], "verlet", function (v) { method = v; reset(); });
    button(s.panel, "Circular", function () { reset(); });
    playBtn(s.panel, sim);

    // drag to set velocity
    function pAt(ev) { var r = s.canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    s.canvas.addEventListener("pointerdown", function (e) {
      var bp = W2P(pos), m = pAt(e);
      if (Math.hypot(m.x - bp.x, m.y - bp.y) < 26) { aiming = true; aimV = m; s.canvas.setPointerCapture(e.pointerId); }
    });
    s.canvas.addEventListener("pointermove", function (e) { if (aiming) aimV = pAt(e); });
    s.canvas.addEventListener("pointerup", function () {
      if (aiming && aimV) {
        var bp = W2P(pos);
        vel = [(aimV.x - bp.x) / SC * 0.9, -(aimV.y - bp.y) / SC * 0.9];
        trail = [];
      }
      aiming = false; aimV = null;
    });
    s.canvas.style.cursor = "crosshair";

    loop(sim, function (dt) {
      if (!aiming) {
        var steps = 8, h = Math.min(dt, 1 / 60) * 1.4 / steps;
        for (var i = 0; i < steps; i++) {
          if (method === "euler") {
            var a = accel(pos);
            pos = [pos[0] + vel[0] * h, pos[1] + vel[1] * h];
            vel = [vel[0] + a[0] * h, vel[1] + a[1] * h];
          } else {
            var a1 = accel(pos);
            var vh = [vel[0] + 0.5 * a1[0] * h, vel[1] + 0.5 * a1[1] * h];
            pos = [pos[0] + vh[0] * h, pos[1] + vh[1] * h];
            var a2 = accel(pos);
            vel = [vh[0] + 0.5 * a2[0] * h, vh[1] + 0.5 * a2[1] * h];
          }
        }
        trail.push([pos[0], pos[1]]); if (trail.length > 1400) trail.shift();
      }
      clear(s);
      var c0 = center();
      // central mass
      var grd = s.ctx.createRadialGradient(c0.x, c0.y, 2, c0.x, c0.y, 16);
      grd.addColorStop(0, GOLD); grd.addColorStop(1, "rgba(240,173,63,0)");
      s.ctx.fillStyle = grd; s.ctx.beginPath(); s.ctx.arc(c0.x, c0.y, 16, 0, 7); s.ctx.fill();
      s.ctx.fillStyle = INK; s.ctx.beginPath(); s.ctx.arc(c0.x, c0.y, 5, 0, 7); s.ctx.fill();
      // trail
      s.ctx.lineWidth = 1.8;
      for (var t = 1; t < trail.length; t++) {
        var a0 = W2P(trail[t - 1]), b0 = W2P(trail[t]);
        s.ctx.strokeStyle = "rgba(47,73,224," + (t / trail.length * 0.8).toFixed(3) + ")";
        s.ctx.beginPath(); s.ctx.moveTo(a0.x, a0.y); s.ctx.lineTo(b0.x, b0.y); s.ctx.stroke();
      }
      // body
      var bp = W2P(pos);
      s.ctx.fillStyle = BLUE; s.ctx.beginPath(); s.ctx.arc(bp.x, bp.y, 7, 0, 7); s.ctx.fill();
      // aim arrow
      if (aiming && aimV) {
        s.ctx.strokeStyle = INK; s.ctx.lineWidth = 2; s.ctx.setLineDash([5, 4]);
        s.ctx.beginPath(); s.ctx.moveTo(bp.x, bp.y); s.ctx.lineTo(aimV.x, aimV.y); s.ctx.stroke();
        s.ctx.setLineDash([]);
      }
      var r = Math.hypot(pos[0], pos[1]);
      var E = 0.5 * (vel[0] * vel[0] + vel[1] * vel[1]) - mu / Math.max(r, 1e-3);
      rE(E.toFixed(3));
      rState(r > 6 ? "escaping" : (E < -0.02 ? "bound" : "marginal"));
    });
  }

  // ===================================================================
  // DOUBLE PENDULUM  (two ICs, 1e-4 apart -> chaos)
  // ===================================================================
  function doublependulum(c) {
    var s = shell(c, 380);
    var g = 9.81, m1 = 1, m2 = 1, L1 = 1, L2 = 1;
    var A, B, trailA = [], trailB = [];
    var sim = { running: !REDUCE, _raf: 0 };
    var startDeg = 120;

    function mk(off) { var th = startDeg * Math.PI / 180; return { t1: th, t2: th + off, w1: 0, w2: 0 }; }
    function reset() { A = mk(0); B = mk(1e-4); trailA = []; trailB = []; }
    reset();

    function deriv(st) {
      var d = st.t1 - st.t2;
      var den = 2 * m1 + m2 - m2 * Math.cos(2 * st.t1 - 2 * st.t2);
      var a1 = (-g * (2 * m1 + m2) * Math.sin(st.t1)
        - m2 * g * Math.sin(st.t1 - 2 * st.t2)
        - 2 * Math.sin(d) * m2 * (st.w2 * st.w2 * L2 + st.w1 * st.w1 * L1 * Math.cos(d))) / (L1 * den);
      var a2 = (2 * Math.sin(d) * (st.w1 * st.w1 * L1 * (m1 + m2)
        + g * (m1 + m2) * Math.cos(st.t1)
        + st.w2 * st.w2 * L2 * m2 * Math.cos(d))) / (L2 * den);
      return [st.w1, st.w2, a1, a2];
    }
    function rk4(st, h) {
      function add(b, k, f) { return { t1: b.t1 + k[0] * f, t2: b.t2 + k[1] * f, w1: b.w1 + k[2] * f, w2: b.w2 + k[3] * f }; }
      var k1 = deriv(st);
      var k2 = deriv(add(st, k1, h / 2));
      var k3 = deriv(add(st, k2, h / 2));
      var k4 = deriv(add(st, k3, h));
      st.t1 += h * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
      st.t2 += h * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
      st.w1 += h * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) / 6;
      st.w2 += h * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]) / 6;
    }

    var rSep = readout(s.panel, "separation");
    slider(s.panel, { label: "start angle", min: 30, max: 175, step: 1, value: startDeg, unit: "°", on: function (v) { startDeg = v; reset(); } });
    button(s.panel, "Reset", reset);
    playBtn(s.panel, sim);

    function draw(st, col, lw) {
      var p = { x: s.W / 2, y: s.H * 0.40 };
      var sc = Math.min(s.H * 0.21, s.W * 0.21);
      var x1 = p.x + sc * Math.sin(st.t1), y1 = p.y + sc * Math.cos(st.t1);
      var x2 = x1 + sc * Math.sin(st.t2), y2 = y1 + sc * Math.cos(st.t2);
      s.ctx.strokeStyle = col; s.ctx.lineWidth = lw;
      s.ctx.beginPath(); s.ctx.moveTo(p.x, p.y); s.ctx.lineTo(x1, y1); s.ctx.lineTo(x2, y2); s.ctx.stroke();
      s.ctx.fillStyle = col; s.ctx.beginPath(); s.ctx.arc(x1, y1, 5, 0, 7); s.ctx.fill();
      s.ctx.beginPath(); s.ctx.arc(x2, y2, 7, 0, 7); s.ctx.fill();
      return { x: x2, y: y2 };
    }

    loop(sim, function (dt) {
      var steps = 10, h = Math.min(dt, 1 / 50) / steps;
      for (var i = 0; i < steps; i++) { rk4(A, h); rk4(B, h); }
      clear(s);
      // pivot
      s.ctx.fillStyle = INK; s.ctx.beginPath(); s.ctx.arc(s.W / 2, s.H * 0.40, 4, 0, 7); s.ctx.fill();
      // trails
      function trail(arr, col) {
        s.ctx.lineWidth = 1.5;
        for (var t = 1; t < arr.length; t++) {
          s.ctx.strokeStyle = col.replace("A", (t / arr.length * 0.7).toFixed(3));
          s.ctx.beginPath(); s.ctx.moveTo(arr[t - 1].x, arr[t - 1].y); s.ctx.lineTo(arr[t].x, arr[t].y); s.ctx.stroke();
        }
      }
      trail(trailB, "rgba(240,173,63,A)");
      trail(trailA, "rgba(47,73,224,A)");
      var pB = draw(B, GOLD, 2.2);
      var pA = draw(A, BLUE, 2.6);
      trailA.push(pA); if (trailA.length > 220) trailA.shift();
      trailB.push(pB); if (trailB.length > 220) trailB.shift();
      rSep((Math.hypot(pA.x - pB.x, pA.y - pB.y) / Math.min(s.H * 0.21, s.W * 0.21)).toFixed(3) + " L");
    });
  }

  // ===================================================================
  // ISING  (Metropolis Monte Carlo, live temperature)
  // ===================================================================
  function ising(c) {
    var s = shell(c, 360);
    var N = 80, J = 1, T = 2.27;
    var spin = new Int8Array(N * N);
    var off = document.createElement("canvas"); off.width = N; off.height = N;
    var octx = off.getContext("2d");
    var img = octx.createImageData(N, N);
    var sim = { running: !REDUCE, _raf: 0 };
    function randomize() { for (var i = 0; i < N * N; i++) spin[i] = Math.random() < 0.5 ? 1 : -1; }
    randomize();

    var rM = readout(s.panel, "|m|");
    var rPhase = readout(s.panel, "phase");
    slider(s.panel, { label: "temperature", min: 1.0, max: 3.6, step: 0.01, value: T, unit: " J", fmt: function (x) { return x.toFixed(2); }, on: function (v) { T = v; } });
    button(s.panel, "T꜀ ≈ 2.27", function () { T = 2.27; tslider.set(2.27); });
    var btnR = button(s.panel, "Randomize", randomize);
    playBtn(s.panel, sim);
    // grab slider ref for the Tc button
    var tslider = { set: function () {} };
    (function () { var inps = s.panel.querySelectorAll("input[type=range]"); if (inps[0]) tslider = { set: function (v) { inps[0].value = v; inps[0].dispatchEvent(new Event("input")); } }; })();

    function sweep() {
      var e4 = Math.exp(-4 * J / T), e8 = Math.exp(-8 * J / T);
      for (var n = 0; n < N * N; n++) {
        var i = (Math.random() * N) | 0, j = (Math.random() * N) | 0;
        var idx = i * N + j;
        var sm = spin[((i + 1) % N) * N + j] + spin[((i - 1 + N) % N) * N + j]
          + spin[i * N + (j + 1) % N] + spin[i * N + (j - 1 + N) % N];
        var dE = 2 * J * spin[idx] * sm;
        if (dE <= 0 || (dE === 4 ? Math.random() < e4 : Math.random() < e8)) spin[idx] = -spin[idx];
      }
    }

    loop(sim, function () {
      sweep(); sweep();
      var d = img.data, m = 0;
      for (var k = 0; k < N * N; k++) {
        m += spin[k];
        var up = spin[k] > 0;
        // up = ink/blue, down = paper
        d[k * 4] = up ? 0x2f : 0xf6; d[k * 4 + 1] = up ? 0x49 : 0xf2; d[k * 4 + 2] = up ? 0xe0 : 0xe9; d[k * 4 + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      clear(s, PAPER);
      var size = Math.min(s.W, s.H) - 8;
      var ox = (s.W - size) / 2, oy = (s.H - size) / 2;
      s.ctx.imageSmoothingEnabled = false;
      s.ctx.drawImage(off, ox, oy, size, size);
      s.ctx.strokeStyle = LINE; s.ctx.lineWidth = 1; s.ctx.strokeRect(ox, oy, size, size);
      var mm = Math.abs(m) / (N * N);
      rM(mm.toFixed(2));
      rPhase(T < 2.18 ? "ordered" : T > 2.40 ? "disordered" : "critical");
    });
  }

  // ── shared helpers for the extended sims ───────────────────────────
  function drawSpringCoil(ctx, x1, y, x2, coils, amp) {
    ctx.beginPath(); ctx.moveTo(x1, y);
    var lead = 14, span = (x2 - x1) - 2 * lead;
    ctx.lineTo(x1 + lead, y);
    for (var i = 1; i < coils; i++) { var t = i / coils; ctx.lineTo(x1 + lead + span * t, y + (i % 2 ? -amp : amp)); }
    ctx.lineTo(x2 - lead, y); ctx.lineTo(x2, y); ctx.stroke();
  }
  function stepDisks(ds, box, e, gy, dt) {
    var sub = 4, h = dt / sub, i, j;
    for (var q = 0; q < sub; q++) {
      for (i = 0; i < ds.length; i++) {
        var d = ds[i]; d.v[1] += gy * h; d.p[0] += d.v[0] * h; d.p[1] += d.v[1] * h;
        if (d.p[0] - d.r < box.x0) { d.p[0] = box.x0 + d.r; d.v[0] = Math.abs(d.v[0]) * e; }
        if (d.p[0] + d.r > box.x1) { d.p[0] = box.x1 - d.r; d.v[0] = -Math.abs(d.v[0]) * e; }
        if (d.p[1] - d.r < box.y0) { d.p[1] = box.y0 + d.r; d.v[1] = Math.abs(d.v[1]) * e; }
        if (d.p[1] + d.r > box.y1) { d.p[1] = box.y1 - d.r; d.v[1] = -Math.abs(d.v[1]) * e; }
      }
      for (i = 0; i < ds.length; i++) for (j = i + 1; j < ds.length; j++) {
        var a = ds[i], b = ds[j], nx = b.p[0] - a.p[0], ny = b.p[1] - a.p[1];
        var dist = Math.hypot(nx, ny), mind = a.r + b.r;
        if (dist > 1e-6 && dist < mind) {
          nx /= dist; ny /= dist;
          var vn = (a.v[0] - b.v[0]) * nx + (a.v[1] - b.v[1]) * ny;
          if (vn < 0) { var jm = -(1 + e) * vn / (1 / a.m + 1 / b.m); a.v[0] += jm / a.m * nx; a.v[1] += jm / a.m * ny; b.v[0] -= jm / b.m * nx; b.v[1] -= jm / b.m * ny; }
          var ov = (mind - dist) / 2; a.p[0] -= nx * ov; a.p[1] -= ny * ov; b.p[0] += nx * ov; b.p[1] += ny * ov;
        }
      }
    }
  }

  // ===================================================================
  // SPRING  (SHM + damping regimes, oscilloscope)
  // ===================================================================
  function spring(c) {
    var s = shell(c, 300), k = 9, m = 1, cc = 0, x = 1, v = 0, trace = [];
    var sim = { running: !REDUCE, _raf: 0 };
    var rReg = readout(s.panel, "regime"), rW = readout(s.panel, "ω₀");
    slider(s.panel, { label: "stiffness k", min: 1, max: 30, step: 0.5, value: k, fmt: function (x) { return x.toFixed(1); }, on: function (val) { k = val; } });
    slider(s.panel, { label: "mass m", min: 0.5, max: 4, step: 0.1, value: m, fmt: function (x) { return x.toFixed(1); }, on: function (val) { m = val; } });
    slider(s.panel, { label: "damping c", min: 0, max: 14, step: 0.2, value: cc, fmt: function (x) { return x.toFixed(1); }, on: function (val) { cc = val; } });
    button(s.panel, "Pluck", function () { x = 1; v = 0; trace = []; });
    playBtn(s.panel, sim);
    loop(sim, function (dt) {
      var steps = 8, h = dt / steps;
      for (var i = 0; i < steps; i++) {
        var f = function (xx, vv) { return [vv, -(k / m) * xx - (cc / m) * vv]; };
        var k1 = f(x, v), k2 = f(x + k1[0] * h / 2, v + k1[1] * h / 2), k3 = f(x + k2[0] * h / 2, v + k2[1] * h / 2), k4 = f(x + k3[0] * h, v + k3[1] * h);
        x += h * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6; v += h * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
      }
      trace.push(x); if (trace.length > Math.max(60, s.W - 90)) trace.shift();
      clear(s);
      var midY = s.H / 2, sc = 60, eqX = 120;
      // equilibrium line
      s.ctx.strokeStyle = "rgba(22,23,29,0.12)"; s.ctx.setLineDash([4, 4]);
      s.ctx.beginPath(); s.ctx.moveTo(eqX, 16); s.ctx.lineTo(eqX, s.H - 16); s.ctx.stroke(); s.ctx.setLineDash([]);
      // oscilloscope trace
      s.ctx.strokeStyle = "rgba(47,73,224,0.5)"; s.ctx.lineWidth = 2; s.ctx.beginPath();
      for (var t = 0; t < trace.length; t++) { var X = eqX + (s.W - eqX - 10) * t / Math.max(1, trace.length - 1); var Y = midY - trace[t] * sc; t ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); }
      s.ctx.stroke();
      // spring + mass on the left
      var mx = 40 + (x + 1) * sc * 0.0 + eqX + x * sc; // mass position relative to eqX
      mx = eqX + x * sc;
      s.ctx.strokeStyle = INK; s.ctx.lineWidth = 2;
      drawSpringCoil(s.ctx, 20, midY, mx, 7, 16);
      s.ctx.fillStyle = "rgba(22,23,29,0.5)"; s.ctx.fillRect(14, midY - 24, 6, 48); // wall
      s.ctx.fillStyle = BLUE; s.ctx.beginPath(); s.ctx.arc(mx, midY, 15, 0, 7); s.ctx.fill();
      s.ctx.strokeStyle = INK; s.ctx.lineWidth = 1.5; s.ctx.stroke();
      var z = cc / (2 * Math.sqrt(m * k));
      rReg(z < 1e-3 ? "undamped" : z < 0.97 ? "underdamped" : z <= 1.03 ? "critical" : "overdamped");
      rW(Math.sqrt(k / m).toFixed(2));
    });
  }

  // ===================================================================
  // N-BODY  (figure-8 / binary, click to add, Verlet)
  // ===================================================================
  function nbody(c) {
    var s = shell(c, 360), G = 1, eps = 0.05, SC = 150, bodies = [];
    var sim = { running: !REDUCE, _raf: 0 };
    function preset(name) {
      if (name === "fig8") {
        var x1 = [0.97000436, -0.24308753], v3 = [-0.93240737, -0.86473146];
        bodies = [
          { m: 1, p: [x1[0], x1[1]], v: [-v3[0] / 2, -v3[1] / 2], tr: [], c: BLUE },
          { m: 1, p: [-x1[0], -x1[1]], v: [-v3[0] / 2, -v3[1] / 2], tr: [], c: GOLD },
          { m: 1, p: [0, 0], v: [v3[0], v3[1]], tr: [], c: "#1c2fa6" }];
      } else {
        bodies = [{ m: 1, p: [-0.5, 0], v: [0, -0.62], tr: [], c: BLUE }, { m: 1, p: [0.5, 0], v: [0, 0.62], tr: [], c: GOLD }];
      }
    }
    preset("fig8");
    var rP = readout(s.panel, "|P|");
    segmented(s.panel, "preset", [{ t: "Figure-8", v: "fig8" }, { t: "Binary", v: "bin" }], "fig8", function (v) { preset(v === "fig8" ? "fig8" : "bin"); });
    button(s.panel, "Clear trails", function () { bodies.forEach(function (b) { b.tr = []; }); });
    playBtn(s.panel, sim);
    function center() { return { x: s.W / 2, y: s.H / 2 }; }
    s.canvas.addEventListener("pointerdown", function (e) {
      var r = s.canvas.getBoundingClientRect(), c0 = center();
      bodies.push({ m: 0.4, p: [((e.clientX - r.left) - c0.x) / SC, ((e.clientY - r.top) - c0.y) / SC], v: [0, 0], tr: [], c: "#1c2fa6" });
    });
    function accel(p, self) {
      var ax = 0, ay = 0;
      for (var i = 0; i < bodies.length; i++) { if (bodies[i] === self) continue; var dx = bodies[i].p[0] - p[0], dy = bodies[i].p[1] - p[1]; var d = Math.pow(dx * dx + dy * dy + eps * eps, 1.5); ax += G * bodies[i].m * dx / d; ay += G * bodies[i].m * dy / d; }
      return [ax, ay];
    }
    loop(sim, function (dt) {
      var steps = 6, h = Math.min(dt, 1 / 60) / steps;
      for (var q = 0; q < steps; q++) {
        var a = bodies.map(function (b) { return accel(b.p, b); });
        for (var i = 0; i < bodies.length; i++) { var b = bodies[i]; b.v[0] += 0.5 * a[i][0] * h; b.v[1] += 0.5 * a[i][1] * h; b.p[0] += b.v[0] * h; b.p[1] += b.v[1] * h; }
        var a2 = bodies.map(function (b) { return accel(b.p, b); });
        for (i = 0; i < bodies.length; i++) { bodies[i].v[0] += 0.5 * a2[i][0] * h; bodies[i].v[1] += 0.5 * a2[i][1] * h; }
      }
      clear(s); var c0 = center();
      var Px = 0, Py = 0;
      bodies.forEach(function (b) {
        Px += b.m * b.v[0]; Py += b.m * b.v[1];
        b.tr.push([b.p[0], b.p[1]]); if (b.tr.length > 600) b.tr.shift();
        s.ctx.lineWidth = 1.4;
        for (var t = 1; t < b.tr.length; t++) { var a0 = { x: c0.x + b.tr[t - 1][0] * SC, y: c0.y + b.tr[t - 1][1] * SC }, b0 = { x: c0.x + b.tr[t][0] * SC, y: c0.y + b.tr[t][1] * SC }; s.ctx.globalAlpha = t / b.tr.length * 0.7; s.ctx.strokeStyle = b.c; s.ctx.beginPath(); s.ctx.moveTo(a0.x, a0.y); s.ctx.lineTo(b0.x, b0.y); s.ctx.stroke(); }
        s.ctx.globalAlpha = 1;
        s.ctx.fillStyle = b.c; s.ctx.beginPath(); s.ctx.arc(c0.x + b.p[0] * SC, c0.y + b.p[1] * SC, 4 + b.m * 3, 0, 7); s.ctx.fill();
      });
      rP(Math.hypot(Px, Py).toFixed(3));
    });
  }

  // ===================================================================
  // COLLISIONS  (restitution sweep)
  // ===================================================================
  function collisions(c) {
    var s = shell(c, 320), e = 1.0, gravity = 0, ds = [];
    var sim = { running: !REDUCE, _raf: 0 };
    function box() { return { x0: 12, y0: 12, x1: s.W - 12, y1: s.H - 12 }; }
    function reset() {
      ds = []; var b = box();
      for (var i = 0; i < 7; i++) ds.push({ p: [b.x0 + 30 + Math.random() * (b.x1 - b.x0 - 60), b.y0 + 30 + Math.random() * (b.y1 - b.y0 - 60)], v: [(Math.random() - 0.5) * 320, (Math.random() - 0.5) * 320], r: 16, m: 1, c: i % 2 ? GOLD : BLUE });
    }
    reset();
    var rKE = readout(s.panel, "kinetic E"), rP = readout(s.panel, "|P|");
    slider(s.panel, { label: "restitution e", min: 0, max: 1, step: 0.05, value: e, fmt: function (x) { return x.toFixed(2); }, on: function (v) { e = v; } });
    segmented(s.panel, "gravity", [{ t: "Off", v: 0 }, { t: "On", v: 520 }], 0, function (v) { gravity = v; });
    button(s.panel, "Reset", reset);
    playBtn(s.panel, sim);
    loop(sim, function (dt) {
      stepDisks(ds, box(), e, gravity, Math.min(dt, 1 / 50));
      clear(s); var b = box();
      s.ctx.strokeStyle = LINE; s.ctx.lineWidth = 1; s.ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      var KE = 0, Px = 0, Py = 0;
      ds.forEach(function (d) { KE += 0.5 * d.m * (d.v[0] * d.v[0] + d.v[1] * d.v[1]); Px += d.m * d.v[0]; Py += d.m * d.v[1]; s.ctx.fillStyle = d.c; s.ctx.beginPath(); s.ctx.arc(d.p[0], d.p[1], d.r, 0, 7); s.ctx.fill(); s.ctx.strokeStyle = INK; s.ctx.lineWidth = 1.2; s.ctx.stroke(); });
      rKE((KE / 1000).toFixed(1) + " kJ");
      rP((Math.hypot(Px, Py) / 1000).toFixed(2));
    });
  }

  // ===================================================================
  // RIGID BODY  (rod bouncing, off-center spin)
  // ===================================================================
  function rigidbody(c) {
    var s = shell(c, 340), e = 0.9, g = 700;
    var st, sim = { running: !REDUCE, _raf: 0 };
    function reset() { st = { x: s.W / 2, y: 70, th: 0.4, vx: 40, vy: 0, om: 0 }; }
    reset();
    var L = function () { return Math.min(s.W * 0.32, 150); }, m = 1;
    var rOm = readout(s.panel, "spin ω");
    slider(s.panel, { label: "restitution e", min: 0.2, max: 1, step: 0.05, value: e, fmt: function (x) { return x.toFixed(2); }, on: function (v) { e = v; } });
    button(s.panel, "Drop", reset);
    playBtn(s.panel, sim);
    s.canvas.addEventListener("pointerdown", function (ev) { var r = s.canvas.getBoundingClientRect(); st = { x: ev.clientX - r.left, y: ev.clientY - r.top, th: Math.random() * 1.5, vx: (Math.random() - 0.5) * 120, vy: 0, om: (Math.random() - 0.5) * 4 }; });
    loop(sim, function (dt) {
      var Ln = L(), I = m * Ln * Ln / 12, sub = 6, h = Math.min(dt, 1 / 50) / sub;
      var box = { x0: 12, y0: 12, x1: s.W - 12, y1: s.H - 12 };
      for (var q = 0; q < sub; q++) {
        st.vy += g * h; st.x += st.vx * h; st.y += st.vy * h; st.th += st.om * h;
        var ends = [[Math.cos(st.th) * Ln / 2, Math.sin(st.th) * Ln / 2], [-Math.cos(st.th) * Ln / 2, -Math.sin(st.th) * Ln / 2]];
        for (var k = 0; k < 2; k++) {
          var rx = ends[k][0], ry = ends[k][1], ex = st.x + rx, ey = st.y + ry, nx = 0, ny = 0, pen = 0;
          if (ey > box.y1) { ny = -1; pen = ey - box.y1; } else if (ey < box.y0) { ny = 1; pen = box.y0 - ey; }
          else if (ex < box.x0) { nx = 1; pen = box.x0 - ex; } else if (ex > box.x1) { nx = -1; pen = ex - box.x1; }
          if (pen > 0) {
            var vcx = st.vx - st.om * ry, vcy = st.vy + st.om * rx;
            var vn = vcx * nx + vcy * ny;
            if (vn < 0) { var rxn = rx * ny - ry * nx; var jimp = -(1 + e) * vn / (1 / m + rxn * rxn / I); st.vx += jimp * nx / m; st.vy += jimp * ny / m; st.om += jimp * rxn / I; }
            st.x += nx * pen; st.y += ny * pen;
          }
        }
      }
      clear(s);
      s.ctx.strokeStyle = LINE; s.ctx.lineWidth = 1; s.ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      var c1 = Math.cos(st.th) * Ln / 2, s1 = Math.sin(st.th) * Ln / 2;
      s.ctx.strokeStyle = BLUE; s.ctx.lineWidth = 7; s.ctx.lineCap = "round";
      s.ctx.beginPath(); s.ctx.moveTo(st.x - c1, st.y - s1); s.ctx.lineTo(st.x + c1, st.y + s1); s.ctx.stroke();
      s.ctx.fillStyle = GOLD; s.ctx.beginPath(); s.ctx.arc(st.x + c1, st.y + s1, 6, 0, 7); s.ctx.fill();
      s.ctx.lineCap = "butt";
      rOm(st.om.toFixed(2) + " rad/s");
    });
  }

  // ===================================================================
  // MASS-SPRING CHAIN  (pulse / modes, fixed vs free ends)
  // ===================================================================
  function chain(c) {
    var s = shell(c, 300), N = 90, u = new Float64Array(N), v = new Float64Array(N), k = 1, m = 1, gamma = 0, ends = "fixed";
    var sim = { running: !REDUCE, _raf: 0 };
    function pulse() { u = new Float64Array(N); v = new Float64Array(N); for (var i = 0; i < N; i++) { var d = i - N * 0.3; u[i] = Math.exp(-d * d / 30); } }
    function mode(j) { u = new Float64Array(N); v = new Float64Array(N); for (var i = 0; i < N; i++) u[i] = Math.sin(Math.PI * j * i / (N - 1)); }
    pulse();
    slider(s.panel, { label: "damping", min: 0, max: 0.6, step: 0.02, value: gamma, fmt: function (x) { return x.toFixed(2); }, on: function (val) { gamma = val; } });
    segmented(s.panel, "ends", [{ t: "Fixed", v: "fixed" }, { t: "Free", v: "free" }], "fixed", function (val) { ends = val; });
    button(s.panel, "Pulse", pulse);
    button(s.panel, "Mode 1", function () { mode(1); });
    button(s.panel, "Mode 3", function () { mode(3); });
    playBtn(s.panel, sim);
    function accel(arr, i) {
      var l = i > 0 ? arr[i - 1] : (ends === "free" ? arr[i] : 0);
      var r = i < N - 1 ? arr[i + 1] : (ends === "free" ? arr[i] : 0);
      return (k / m) * (r - 2 * arr[i] + l);
    }
    loop(sim, function (dt) {
      var steps = 14, h = Math.min(dt, 1 / 40) / steps * 6;
      for (var q = 0; q < steps; q++) {
        for (var i = 0; i < N; i++) v[i] += 0.5 * (accel(u, i) - gamma * v[i]) * h;
        for (i = 0; i < N; i++) u[i] += v[i] * h;
        if (ends === "fixed") { u[0] = 0; u[N - 1] = 0; }
        for (i = 0; i < N; i++) v[i] += 0.5 * (accel(u, i) - gamma * v[i]) * h;
      }
      clear(s);
      var midY = s.H / 2, amp = s.H * 0.32;
      s.ctx.strokeStyle = "rgba(22,23,29,0.10)"; s.ctx.beginPath(); s.ctx.moveTo(10, midY); s.ctx.lineTo(s.W - 10, midY); s.ctx.stroke();
      s.ctx.strokeStyle = BLUE; s.ctx.lineWidth = 2.2; s.ctx.beginPath();
      for (i = 0; i < N; i++) { var X = 14 + (s.W - 28) * i / (N - 1), Y = midY - u[i] * amp; i ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); }
      s.ctx.stroke();
      for (i = 0; i < N; i += 6) { var X2 = 14 + (s.W - 28) * i / (N - 1); s.ctx.fillStyle = GOLD; s.ctx.beginPath(); s.ctx.arc(X2, midY - u[i] * amp, 3, 0, 7); s.ctx.fill(); }
    });
  }

  // ===================================================================
  // FOURIER  (chain shape + live mode spectrum)
  // ===================================================================
  function fourier(c) {
    var s = shell(c, 340), N = 90, M = 14, u = new Float64Array(N), v = new Float64Array(N), k = 1, m = 1;
    var sim = { running: !REDUCE, _raf: 0 };
    function setShape(name) {
      u = new Float64Array(N); v = new Float64Array(N);
      for (var i = 0; i < N; i++) {
        var xi = i / (N - 1);
        if (name === "mode3") u[i] = Math.sin(3 * Math.PI * i / (N - 1));
        else if (name === "triangle") u[i] = xi < 0.5 ? 2 * xi : 2 * (1 - xi);
        else { var d = i - N / 2; u[i] = Math.exp(-d * d / 40); }
      }
    }
    setShape("triangle");
    segmented(s.panel, "initial shape", [{ t: "Triangle", v: "triangle" }, { t: "Mode 3", v: "mode3" }, { t: "Gaussian", v: "gauss" }], "triangle", function (val) { setShape(val); });
    playBtn(s.panel, sim);
    function accel(arr, i) { var l = i > 0 ? arr[i - 1] : 0, r = i < N - 1 ? arr[i + 1] : 0; return (k / m) * (r - 2 * arr[i] + l); }
    loop(sim, function (dt) {
      var steps = 12, h = Math.min(dt, 1 / 40) / steps * 6;
      for (var q = 0; q < steps; q++) {
        for (var i = 0; i < N; i++) v[i] += 0.5 * accel(u, i) * h;
        for (i = 0; i < N; i++) u[i] += v[i] * h;
        u[0] = 0; u[N - 1] = 0;
        for (i = 0; i < N; i++) v[i] += 0.5 * accel(u, i) * h;
      }
      clear(s);
      var topH = s.H * 0.42, midY = topH / 2, amp = topH * 0.4;
      s.ctx.strokeStyle = BLUE; s.ctx.lineWidth = 2; s.ctx.beginPath();
      for (i = 0; i < N; i++) { var X = 14 + (s.W - 28) * i / (N - 1), Y = midY - u[i] * amp; i ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); }
      s.ctx.stroke();
      s.ctx.strokeStyle = LINE; s.ctx.beginPath(); s.ctx.moveTo(10, topH); s.ctx.lineTo(s.W - 10, topH); s.ctx.stroke();
      // mode energies
      var E = [], Emax = 1e-9;
      for (var jm = 1; jm <= M; jm++) {
        var aj = 0, adj = 0, wj = 2 * Math.sqrt(k / m) * Math.sin(Math.PI * jm / (2 * (N - 1)));
        for (i = 0; i < N; i++) { var ph = Math.sqrt(2 / (N - 1)) * Math.sin(Math.PI * jm * i / (N - 1)); aj += u[i] * ph; adj += v[i] * ph; }
        var ej = 0.5 * m * (adj * adj + wj * wj * aj * aj); E.push(ej); if (ej > Emax) Emax = ej;
      }
      var bw = (s.W - 28) / M, base = s.H - 24;
      for (jm = 0; jm < M; jm++) {
        var bh = (E[jm] / Emax) * (s.H * 0.42); var bx = 14 + jm * bw;
        s.ctx.fillStyle = GOLD; s.ctx.fillRect(bx + 2, base - bh, bw - 5, bh);
      }
      s.ctx.fillStyle = SOFT; s.ctx.font = "11px monospace"; s.ctx.fillText("mode energy spectrum (j = 1 … " + M + ")", 16, base + 16);
    });
  }

  // ===================================================================
  // LORENTZ  (Boris pusher, E×B drift)
  // ===================================================================
  function lorentz(c) {
    var s = shell(c, 360), Bz = 1.2, Ey = 0, q = 1, m = 1, method = "boris";
    var p = [0, 0], vv = [1.4, 0], trail = [], sim = { running: !REDUCE, _raf: 0 }, SC = 60;
    function reset() { p = [0, 0]; vv = [1.4, 0]; trail = []; }
    var rKE = readout(s.panel, "kinetic E");
    slider(s.panel, { label: "B field", min: 0, max: 3, step: 0.1, value: Bz, fmt: function (x) { return x.toFixed(1); }, on: function (v) { Bz = v; reset(); } });
    slider(s.panel, { label: "E field", min: -1.5, max: 1.5, step: 0.1, value: Ey, fmt: function (x) { return x.toFixed(1); }, on: function (v) { Ey = v; reset(); } });
    segmented(s.panel, "charge", [{ t: "+", v: 1 }, { t: "−", v: -1 }], 1, function (v) { q = v; reset(); });
    segmented(s.panel, "pusher", [{ t: "Boris", v: "boris" }, { t: "Euler", v: "euler" }], "boris", function (v) { method = v; reset(); });
    button(s.panel, "Reset", reset);
    playBtn(s.panel, sim);
    loop(sim, function (dt) {
      var steps = 6, h = Math.min(dt, 1 / 60) / steps * 1.3;
      for (var i = 0; i < steps; i++) {
        if (method === "euler") {
          var ax = q / m * (0 + vv[1] * Bz), ay = q / m * (Ey - vv[0] * Bz);
          p = [p[0] + vv[0] * h, p[1] + vv[1] * h]; vv = [vv[0] + ax * h, vv[1] + ay * h];
        } else {
          var vmx = vv[0] + q * 0 / m * h / 2, vmy = vv[1] + q * Ey / m * h / 2;
          var tt = q * Bz / m * h / 2, sfac = 2 * tt / (1 + tt * tt);
          var vpx = vmx + vmy * tt, vpy = vmy - vmx * tt;
          var v2x = vmx + vpy * sfac, v2y = vmy - vpx * sfac;
          vv = [v2x + q * 0 / m * h / 2, v2y + q * Ey / m * h / 2];
          p = [p[0] + vv[0] * h, p[1] + vv[1] * h];
        }
        trail.push([p[0], p[1]]); if (trail.length > 1600) trail.shift();
      }
      clear(s); var cx = s.W * 0.3, cy = s.H / 2;
      // B field dots
      s.ctx.fillStyle = "rgba(22,23,29,0.10)";
      for (var gx = 30; gx < s.W; gx += 46) for (var gy = 26; gy < s.H; gy += 46) { s.ctx.beginPath(); s.ctx.arc(gx, gy, 1.6, 0, 7); s.ctx.fill(); }
      s.ctx.lineWidth = 1.8;
      for (var t = 1; t < trail.length; t++) { var a0 = { x: cx + trail[t - 1][0] * SC, y: cy - trail[t - 1][1] * SC }, b0 = { x: cx + trail[t][0] * SC, y: cy - trail[t][1] * SC }; s.ctx.strokeStyle = "rgba(47,73,224," + (t / trail.length * 0.85).toFixed(3) + ")"; s.ctx.beginPath(); s.ctx.moveTo(a0.x, a0.y); s.ctx.lineTo(b0.x, b0.y); s.ctx.stroke(); }
      s.ctx.fillStyle = GOLD; s.ctx.beginPath(); s.ctx.arc(cx + p[0] * SC, cy - p[1] * SC, 6, 0, 7); s.ctx.fill();
      s.ctx.strokeStyle = INK; s.ctx.lineWidth = 1.3; s.ctx.stroke();
      rKE((0.5 * m * (vv[0] * vv[0] + vv[1] * vv[1])).toFixed(3));
    });
  }

  // ===================================================================
  // ELECTRIC FIELDS  (draggable charges, field arrows)
  // ===================================================================
  function efield(c) {
    var s = shell(c, 360), charges = [], sim = { running: !REDUCE, _raf: 0 }, drag = -1;
    function preset(name) {
      var cx = s.W / 2, cy = s.H / 2;
      if (name === "dipole") charges = [{ x: cx - 70, y: cy, q: 1 }, { x: cx + 70, y: cy, q: -1 }];
      else if (name === "like") charges = [{ x: cx - 70, y: cy, q: 1 }, { x: cx + 70, y: cy, q: 1 }];
      else charges = [{ x: cx - 70, y: cy - 60, q: 1 }, { x: cx + 70, y: cy - 60, q: -1 }, { x: cx - 70, y: cy + 60, q: -1 }, { x: cx + 70, y: cy + 60, q: 1 }];
    }
    preset("dipole");
    segmented(s.panel, "configuration", [{ t: "Dipole", v: "dipole" }, { t: "Like", v: "like" }, { t: "Quadrupole", v: "quad" }], "dipole", function (v) { preset(v === "quad" ? "quad" : v); render(); });
    s.panel.appendChild(el("div", "sim-note", "Drag the charges to move them."));
    function pAt(e) { var r = s.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    s.canvas.addEventListener("pointerdown", function (e) { var m = pAt(e); drag = -1; charges.forEach(function (ch, i) { if (Math.hypot(ch.x - m.x, ch.y - m.y) < 20) drag = i; }); });
    s.canvas.addEventListener("pointermove", function (e) { if (drag >= 0) { var m = pAt(e); charges[drag].x = m.x; charges[drag].y = m.y; render(); } });
    s.canvas.addEventListener("pointerup", function () { drag = -1; });
    s.canvas.style.cursor = "grab";
    function field(x, y) { var ex = 0, ey = 0; for (var i = 0; i < charges.length; i++) { var dx = x - charges[i].x, dy = y - charges[i].y, d2 = dx * dx + dy * dy + 25, d = Math.sqrt(d2); ex += charges[i].q * dx / (d2 * d); ey += charges[i].q * dy / (d2 * d); } return [ex * 4000, ey * 4000]; }
    function render() {
      clear(s); var step = 34;
      for (var x = step / 2; x < s.W; x += step) for (var y = step / 2; y < s.H; y += step) {
        var f = field(x, y), mag = Math.hypot(f[0], f[1]); if (mag < 1e-3) continue;
        var len = Math.min(15, 5 + Math.log(1 + mag) * 3), ux = f[0] / mag, uy = f[1] / mag;
        var al = Math.min(0.7, 0.18 + Math.log(1 + mag) * 0.08);
        s.ctx.strokeStyle = "rgba(47,73,224," + al.toFixed(3) + ")"; s.ctx.lineWidth = 1.4;
        s.ctx.beginPath(); s.ctx.moveTo(x - ux * len, y - uy * len); s.ctx.lineTo(x + ux * len, y + uy * len); s.ctx.stroke();
        s.ctx.beginPath(); s.ctx.moveTo(x + ux * len, y + uy * len); s.ctx.lineTo(x + ux * len - (ux * 4 + uy * 3), y + uy * len - (uy * 4 - ux * 3)); s.ctx.stroke();
      }
      charges.forEach(function (ch) {
        s.ctx.fillStyle = ch.q > 0 ? "#d23b3b" : "#2f49e0"; s.ctx.beginPath(); s.ctx.arc(ch.x, ch.y, 13, 0, 7); s.ctx.fill();
        s.ctx.strokeStyle = "#fff"; s.ctx.lineWidth = 2; s.ctx.beginPath();
        s.ctx.moveTo(ch.x - 6, ch.y); s.ctx.lineTo(ch.x + 6, ch.y); if (ch.q > 0) { s.ctx.moveTo(ch.x, ch.y - 6); s.ctx.lineTo(ch.x, ch.y + 6); } s.ctx.stroke();
      });
    }
    // static (no animation needed); render on resize
    var ro = window.ResizeObserver ? new ResizeObserver(render) : null; if (ro) ro.observe(s.canvas); else window.addEventListener("resize", render);
    setTimeout(render, 30); render();
    sim.running = false; if (sim._playBtn) sim._playBtn.remove();
  }

  // ===================================================================
  // MAXWELL FDTD  (1D Ez/Hy, dielectric + boundaries)
  // ===================================================================
  function fdtd(c) {
    var s = shell(c, 300), N = 320, Ez = new Float64Array(N), Hy = new Float64Array(N), S = 0.5, n = 0, epsr, slab = false, bc = "mirror";
    var sim = { running: !REDUCE, _raf: 0 };
    function build() { epsr = new Float64Array(N); for (var i = 0; i < N; i++) epsr[i] = (slab && i > N * 0.6) ? 4 : 1; }
    function reset() { Ez = new Float64Array(N); Hy = new Float64Array(N); n = 0; build(); }
    reset();
    segmented(s.panel, "right wall", [{ t: "Mirror (PEC)", v: "mirror" }, { t: "Absorbing", v: "abs" }], "mirror", function (v) { bc = v; reset(); });
    segmented(s.panel, "dielectric", [{ t: "Off", v: 0 }, { t: "On (n=2)", v: 1 }], 0, function (v) { slab = !!v; reset(); });
    button(s.panel, "Pulse", function () { reset(); });
    playBtn(s.panel, sim);
    loop(sim, function () {
      for (var it = 0; it < 4; it++) {
        var e0 = Ez[1];
        for (var i = 0; i < N - 1; i++) Hy[i] += S * (Ez[i] - Ez[i + 1]);
        for (i = 1; i < N; i++) Ez[i] += (S / epsr[i]) * (Hy[i - 1] - Hy[i]);
        // soft source near left
        n++; if (n < 120) { var t = n - 40; Ez[20] += Math.exp(-t * t / 200) * Math.sin(0.3 * n); }
        Ez[0] = 0; // left PEC-ish (source region)
        if (bc === "abs") Ez[N - 1] = e0; else Ez[N - 1] = 0;
      }
      clear(s);
      var midY = s.H / 2, amp = s.H * 0.36;
      if (slab) { var sx = 14 + (s.W - 28) * 0.6; s.ctx.fillStyle = "rgba(240,173,63,0.16)"; s.ctx.fillRect(sx, 8, s.W - 14 - sx, s.H - 16); }
      s.ctx.strokeStyle = "rgba(22,23,29,0.10)"; s.ctx.beginPath(); s.ctx.moveTo(10, midY); s.ctx.lineTo(s.W - 10, midY); s.ctx.stroke();
      s.ctx.strokeStyle = BLUE; s.ctx.lineWidth = 1.8; s.ctx.beginPath();
      for (i = 0; i < N; i++) { var X = 14 + (s.W - 28) * i / (N - 1), Y = midY - Ez[i] * amp; i ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); }
      s.ctx.stroke();
      s.ctx.fillStyle = SOFT; s.ctx.font = "11px monospace"; s.ctx.fillText("Ez field", 16, 20);
    });
  }

  // ===================================================================
  // GAS  (Maxwell-Boltzmann from a single speed)
  // ===================================================================
  function gas(c) {
    var s = shell(c, 340), ds = [], v0 = 180, Nd = 140, sim = { running: !REDUCE, _raf: 0 };
    function boxW() { return s.W * 0.56; }
    function box() { return { x0: 12, y0: 12, x1: boxW() - 6, y1: s.H - 12 }; }
    function reset() { ds = []; var b = box(); for (var i = 0; i < Nd; i++) { var a = Math.random() * 7; ds.push({ p: [b.x0 + 14 + Math.random() * (b.x1 - b.x0 - 28), b.y0 + 14 + Math.random() * (b.y1 - b.y0 - 28)], v: [v0 * Math.cos(a), v0 * Math.sin(a)], r: 6, m: 1 }); } }
    reset();
    var rT = readout(s.panel, "temperature");
    slider(s.panel, { label: "initial speed", min: 100, max: 280, step: 10, value: v0, on: function (v) { v0 = v; reset(); } });
    button(s.panel, "Reset", reset);
    playBtn(s.panel, sim);
    loop(sim, function (dt) {
      stepDisks(ds, box(), 1.0, 0, Math.min(dt, 1 / 50));
      clear(s); var b = box();
      s.ctx.strokeStyle = LINE; s.ctx.lineWidth = 1; s.ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      var KE = 0;
      ds.forEach(function (d) { KE += 0.5 * (d.v[0] * d.v[0] + d.v[1] * d.v[1]); s.ctx.fillStyle = BLUE; s.ctx.beginPath(); s.ctx.arc(d.p[0], d.p[1], d.r, 0, 7); s.ctx.fill(); });
      var T = KE / ds.length;
      // histogram
      var hx0 = boxW() + 14, hx1 = s.W - 12, hy1 = s.H - 28, hy0 = 24, bins = 22, hist = new Array(bins).fill(0), vmax = 420;
      ds.forEach(function (d) { var sp = Math.hypot(d.v[0], d.v[1]); var bi = Math.min(bins - 1, (sp / vmax * bins) | 0); hist[bi]++; });
      var hmax = Math.max.apply(null, hist) || 1, bw = (hx1 - hx0) / bins;
      for (var i = 0; i < bins; i++) { var bh = hist[i] / hmax * (hy1 - hy0); s.ctx.fillStyle = "rgba(47,73,224,0.5)"; s.ctx.fillRect(hx0 + i * bw + 1, hy1 - bh, bw - 2, bh); }
      // Maxwell-Boltzmann (Rayleigh) curve
      s.ctx.strokeStyle = GOLD; s.ctx.lineWidth = 2.2; s.ctx.beginPath();
      var norm = 0; for (i = 0; i < 200; i++) { var sp = i / 200 * vmax; norm = Math.max(norm, (sp / T) * Math.exp(-sp * sp / (2 * T))); }
      for (i = 0; i <= 200; i++) { var sp2 = i / 200 * vmax; var f = (sp2 / T) * Math.exp(-sp2 * sp2 / (2 * T)) / norm; var X = hx0 + (sp2 / vmax) * (hx1 - hx0), Y = hy1 - f * (hy1 - hy0) * (hmax / hmax); i ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); }
      s.ctx.stroke();
      s.ctx.fillStyle = SOFT; s.ctx.font = "11px monospace"; s.ctx.fillText("speed distribution", hx0, 18);
      rT(T.toExponential(1));
    });
  }

  // ===================================================================
  // RANDOM WALK  (lattice/gaussian/pearson, MSD)
  // ===================================================================
  function randomwalk(c) {
    var s = shell(c, 340), W = 2400, rule = "gaussian", drift = 0, walkers, steps = 0;
    var sim = { running: !REDUCE, _raf: 0 };
    function reset() { walkers = new Float64Array(W * 2); steps = 0; }
    reset();
    function gauss() { var u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var rMSD = readout(s.panel, "⟨r²⟩ / 4t");
    segmented(s.panel, "step rule", [{ t: "Gaussian", v: "gaussian" }, { t: "Lattice", v: "lattice" }, { t: "Pearson", v: "pearson" }], "gaussian", function (v) { rule = v; reset(); });
    segmented(s.panel, "drift", [{ t: "Off", v: 0 }, { t: "On", v: 1 }], 0, function (v) { drift = v ? 1.0 : 0; reset(); });
    button(s.panel, "Reset", reset);
    playBtn(s.panel, sim);
    loop(sim, function () {
      var a = 3, sig = 3 / Math.SQRT2;
      for (var w = 0; w < W; w++) {
        var dx = 0, dy = 0;
        if (rule === "lattice") { if (Math.random() < 0.5) dx = Math.random() < 0.5 ? a : -a; else dy = Math.random() < 0.5 ? a : -a; }
        else if (rule === "gaussian") { dx = gauss() * sig; dy = gauss() * sig; }
        else { var th = Math.random() * 7; dx = a * Math.cos(th); dy = a * Math.sin(th); }
        walkers[w * 2] += dx + drift; walkers[w * 2 + 1] += dy;
      }
      steps++;
      clear(s); var cx = s.W / 2, cy = s.H / 2, msd = 0, mx = 0, my = 0;
      for (var i = 0; i < W; i++) { mx += walkers[i * 2]; my += walkers[i * 2 + 1]; }
      mx /= W; my /= W;
      for (i = 0; i < W; i += 2) { var x = walkers[i * 2], y = walkers[i * 2 + 1]; msd += (x - mx) * (x - mx) + (y - my) * (y - my); s.ctx.fillStyle = "rgba(47,73,224,0.32)"; s.ctx.fillRect(cx + x * 0.5, cy + y * 0.5, 2, 2); }
      var variance = 0; for (i = 0; i < W; i++) { variance += (walkers[i * 2] - mx) * (walkers[i * 2] - mx) + (walkers[i * 2 + 1] - my) * (walkers[i * 2 + 1] - my); } variance /= W;
      s.ctx.fillStyle = GOLD; s.ctx.beginPath(); s.ctx.arc(cx + mx * 0.5, cy + my * 0.5, 4, 0, 7); s.ctx.fill();
      rMSD(steps > 1 ? (variance / (4 * steps)).toFixed(2) : "—");
    });
  }

  // ===================================================================
  // SCHRODINGER  (Visscher leapfrog, barrier tunneling)
  // ===================================================================
  function schrodinger(c) {
    var s = shell(c, 300), N = 600, R = new Float64Array(N), I = new Float64Array(N), V = new Float64Array(N);
    var sim = { running: !REDUCE, _raf: 0 }, k0 = 0.55, V0 = 0.18, dt = 0.16;
    function build() {
      var x0 = N * 0.28, sig = 34, bw = 26, bc = N * 0.6;
      for (var j = 0; j < N; j++) { var d = j - x0; var g = Math.exp(-d * d / (2 * sig * sig)); R[j] = g * Math.cos(k0 * j); I[j] = g * Math.sin(k0 * j); V[j] = (j > bc - bw && j < bc + bw) ? V0 : 0; }
      R[0] = I[0] = R[N - 1] = I[N - 1] = 0;
    }
    build();
    var rT = readout(s.panel, "transmitted");
    slider(s.panel, { label: "energy k₀", min: 0.3, max: 0.9, step: 0.02, value: k0, fmt: function (x) { return x.toFixed(2); }, on: function (v) { k0 = v; build(); } });
    slider(s.panel, { label: "barrier V₀", min: 0, max: 0.4, step: 0.01, value: V0, fmt: function (x) { return x.toFixed(2); }, on: function (v) { V0 = v; build(); } });
    button(s.panel, "Reset", build);
    playBtn(s.panel, sim);
    function HR(arr, j) { return -0.5 * (arr[j + 1] - 2 * arr[j] + arr[j - 1]) + V[j] * arr[j]; }
    loop(sim, function () {
      for (var it = 0; it < 6; it++) {
        for (var j = 1; j < N - 1; j++) R[j] += dt * HR(I, j);
        for (j = 1; j < N - 1; j++) I[j] -= dt * HR(R, j);
      }
      clear(s);
      var midY = s.H * 0.82, amp = s.H * 0.62, bc = N * 0.6, bw = 26;
      // barrier
      s.ctx.fillStyle = "rgba(240,173,63,0.18)"; var bx0 = 14 + (s.W - 28) * (bc - bw) / (N - 1), bx1 = 14 + (s.W - 28) * (bc + bw) / (N - 1);
      s.ctx.fillRect(bx0, midY - V0 * 320, bx1 - bx0, V0 * 320 + 4);
      s.ctx.strokeStyle = "rgba(22,23,29,0.10)"; s.ctx.beginPath(); s.ctx.moveTo(10, midY); s.ctx.lineTo(s.W - 10, midY); s.ctx.stroke();
      s.ctx.strokeStyle = BLUE; s.ctx.lineWidth = 1.8; s.ctx.beginPath();
      var left = 0, right = 0;
      for (j = 0; j < N; j++) { var dens = R[j] * R[j] + I[j] * I[j]; if (j < bc) left += dens; else right += dens; var X = 14 + (s.W - 28) * j / (N - 1), Y = midY - dens * amp; j ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); }
      s.ctx.stroke();
      s.ctx.fillStyle = SOFT; s.ctx.font = "11px monospace"; s.ctx.fillText("|ψ|²", 16, 18);
      rT((100 * right / (left + right)).toFixed(0) + "%");
    });
  }

  // ===================================================================
  // EIGENSTATES  (imaginary-time relaxation, Thomas solve)
  // ===================================================================
  function eigenstates(c) {
    var s = shell(c, 320), N = 220, V = new Float64Array(N), psi = new Float64Array(N), pot = "harmonic", dtau = 0.4, converged = [];
    var sim = { running: !REDUCE, _raf: 0 }, level = 0;
    function buildV() {
      var cm = N / 2;
      for (var j = 0; j < N; j++) {
        var x = (j - cm) / (N * 0.16);
        if (pot === "harmonic") V[j] = 0.5 * x * x;
        else if (pot === "well") V[j] = 0;
        else V[j] = 0.9 * (x * x - 1.2) * (x * x - 1.2);
      }
    }
    function rnd() { converged = []; level = 0; psi = new Float64Array(N); for (var j = 1; j < N - 1; j++) psi[j] = Math.random() - 0.5; }
    function reset() { buildV(); rnd(); }
    reset();
    var rE = readout(s.panel, "energy E"), rL = readout(s.panel, "state n");
    segmented(s.panel, "potential", [{ t: "Harmonic", v: "harmonic" }, { t: "Box", v: "well" }, { t: "Double well", v: "double" }], "harmonic", function (v) { pot = v; reset(); });
    button(s.panel, "Next state", function () { var cp = new Float64Array(psi); converged.push(cp); level++; psi = new Float64Array(N); for (var j = 1; j < N - 1; j++) psi[j] = Math.random() - 0.5; });
    button(s.panel, "Reset", rnd);
    playBtn(s.panel, sim);
    function norm(a) { var n = 0; for (var j = 0; j < N; j++) n += a[j] * a[j]; n = Math.sqrt(n); if (n > 0) for (j = 0; j < N; j++) a[j] /= n; }
    function project(a) { for (var c2 = 0; c2 < converged.length; c2++) { var dot = 0; for (var j = 0; j < N; j++) dot += converged[c2][j] * a[j]; for (j = 0; j < N; j++) a[j] -= dot * converged[c2][j]; } }
    function thomas() {
      // (I + dtau H) x = psi ; tridiagonal: sub = super = a, diag = 1 + dtau(1+V)
      var a = -0.5 * dtau, n = N;
      var cp = new Float64Array(n), dp = new Float64Array(n);
      var b0 = 1 + dtau * (1 + V[0]);
      cp[0] = a / b0; dp[0] = psi[0] / b0;
      for (var j = 1; j < n; j++) { var bj = 1 + dtau * (1 + V[j]); var mm = bj - a * cp[j - 1]; cp[j] = a / mm; dp[j] = (psi[j] - a * dp[j - 1]) / mm; }
      var x = new Float64Array(n); x[n - 1] = dp[n - 1];
      for (j = n - 2; j >= 0; j--) x[j] = dp[j] - cp[j] * x[j + 1];
      x[0] = 0; x[n - 1] = 0;
      psi = x;
    }
    loop(sim, function () {
      for (var it = 0; it < 4; it++) { thomas(); project(psi); norm(psi); }
      // sign convention
      var mx = 0, mi = 0; for (var j = 0; j < N; j++) if (Math.abs(psi[j]) > mx) { mx = Math.abs(psi[j]); mi = j; } if (psi[mi] < 0) for (j = 0; j < N; j++) psi[j] = -psi[j];
      // energy = <psi|H|psi>
      var E = 0; for (j = 1; j < N - 1; j++) { var Hp = -0.5 * (psi[j + 1] - 2 * psi[j] + psi[j - 1]) + V[j] * psi[j]; E += psi[j] * Hp; }
      clear(s);
      var midY = s.H * 0.62, amp = s.H * 0.5, Vsc = s.H * 0.22;
      s.ctx.strokeStyle = "rgba(22,23,29,0.18)"; s.ctx.lineWidth = 1.5; s.ctx.beginPath();
      for (j = 0; j < N; j++) { var X = 14 + (s.W - 28) * j / (N - 1), Y = midY + Vsc - Math.min(V[j], 4) * Vsc; j ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); }
      s.ctx.stroke();
      // already-converged states faint
      for (var cc2 = 0; cc2 < converged.length; cc2++) { s.ctx.strokeStyle = "rgba(240,173,63,0.5)"; s.ctx.lineWidth = 1.4; s.ctx.beginPath(); for (j = 0; j < N; j++) { var X2 = 14 + (s.W - 28) * j / (N - 1), Y2 = midY - converged[cc2][j] * amp; j ? s.ctx.lineTo(X2, Y2) : s.ctx.moveTo(X2, Y2); } s.ctx.stroke(); }
      s.ctx.strokeStyle = BLUE; s.ctx.lineWidth = 2.2; s.ctx.beginPath();
      for (j = 0; j < N; j++) { var X3 = 14 + (s.W - 28) * j / (N - 1), Y3 = midY - psi[j] * amp; j ? s.ctx.lineTo(X3, Y3) : s.ctx.moveTo(X3, Y3); }
      s.ctx.stroke();
      rE(E.toFixed(3)); rL("φ" + level);
    });
  }

  // ===================================================================
  // KERR-GRRT  (Schwarzschild light bending)
  // ===================================================================
  function lensing(c) {
    var s = shell(c, 360), M = 1, bmin = 2.0, sim = { running: !REDUCE, _raf: 0 }, SC = 18;
    var rBc = readout(s.panel, "shadow b꜀");
    slider(s.panel, { label: "closest ray b", min: 1.0, max: 8.0, step: 0.1, value: bmin, fmt: function (x) { return x.toFixed(1); }, on: function (v) { bmin = v; render(); } });
    function ray(b) {
      // u(phi): u'' + u = 3 M u^2, start at infinity u=0, du/dphi = 1/b
      var u = 1e-4, du = 1 / b, phi = 0, pts = [], hphi = 0.01;
      for (var i = 0; i < 2200; i++) {
        var f = function (u, du) { return [du, -u + 3 * M * u * u]; };
        var k1 = f(u, du), k2 = f(u + k1[0] * hphi / 2, du + k1[1] * hphi / 2), k3 = f(u + k2[0] * hphi / 2, du + k2[1] * hphi / 2), k4 = f(u + k3[0] * hphi, du + k3[1] * hphi);
        u += hphi * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6; du += hphi * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6; phi += hphi;
        if (u <= 1e-4) continue; var r = 1 / u; if (r < 2 * M) { pts.push(null); break; } if (r > 60) { pts.push([r * Math.cos(phi), r * Math.sin(phi)]); break; }
        pts.push([r * Math.cos(phi), r * Math.sin(phi)]);
      }
      return pts;
    }
    function render() {
      clear(s); var cx = s.W / 2, cy = s.H / 2;
      // shadow + photon sphere
      var bc = 3 * Math.sqrt(3) * M;
      s.ctx.fillStyle = "rgba(22,23,29,0.06)"; s.ctx.beginPath(); s.ctx.arc(cx, cy, bc * SC, 0, 7); s.ctx.fill();
      s.ctx.strokeStyle = "rgba(240,173,63,0.6)"; s.ctx.setLineDash([4, 4]); s.ctx.beginPath(); s.ctx.arc(cx, cy, 3 * M * SC, 0, 7); s.ctx.stroke(); s.ctx.setLineDash([]);
      s.ctx.fillStyle = INK; s.ctx.beginPath(); s.ctx.arc(cx, cy, 2 * M * SC, 0, 7); s.ctx.fill();
      var bs = []; for (var i = 0; i < 13; i++) bs.push(bmin + i * 0.7);
      bs.forEach(function (b, idx) {
        var pts = ray(b), captured = pts[pts.length - 1] === null;
        s.ctx.strokeStyle = captured ? "rgba(210,59,59,0.7)" : "rgba(47,73,224," + (0.4 + idx / bs.length * 0.4).toFixed(2) + ")";
        s.ctx.lineWidth = 1.6; s.ctx.beginPath(); var started = false;
        for (var p = 0; p < pts.length; p++) { if (!pts[p]) break; var X = cx + pts[p][0] * SC, Y = cy - pts[p][1] * SC; started ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); started = true; }
        s.ctx.stroke();
      });
      rBc((3 * Math.sqrt(3)).toFixed(2) + " M");
    }
    var ro = window.ResizeObserver ? new ResizeObserver(render) : null; if (ro) ro.observe(s.canvas); else window.addEventListener("resize", render);
    setTimeout(render, 30); render();
    sim.running = false; if (sim._playBtn) sim._playBtn.remove();
  }

  // ===================================================================
  // BH SHADOW  (Bardeen Kerr critical curve vs spin)
  // ===================================================================
  function shadow(c) {
    var s = shell(c, 360), a = 0.5, inc = 60, M = 1, SC = 24, sim = { running: false };
    var rA = readout(s.panel, "spin a"), rD = readout(s.panel, "shape");
    slider(s.panel, { label: "spin a", min: 0, max: 0.998, step: 0.01, value: a, fmt: function (x) { return x.toFixed(2); }, on: function (v) { a = v; render(); } });
    slider(s.panel, { label: "inclination", min: 5, max: 90, step: 1, value: inc, unit: "°", on: function (v) { inc = v; render(); } });
    function curve() {
      var pts = [], i = inc * Math.PI / 180, si = Math.sin(i), ci = Math.cos(i);
      if (a < 0.02) { for (var th = 0; th <= 6.2832; th += 0.05) pts.push([3 * Math.sqrt(3) * Math.cos(th), 3 * Math.sqrt(3) * Math.sin(th)]); return pts; }
      var top = [], bot = [];
      for (var r = M; r < 4.2 * M; r += 0.004) {
        var xi = -(r * r * r - 3 * M * r * r + a * a * r + a * a * M) / (a * (r - M));
        var eta = -(r * r * r * (r * r * r - 6 * M * r * r + 9 * M * M * r - 4 * a * a * M)) / (a * a * (r - M) * (r - M));
        var b2 = eta + a * a * ci * ci - xi * xi * (ci * ci) / (si * si);
        if (b2 < 0) continue;
        var al = -xi / si, be = Math.sqrt(b2);
        top.push([al, be]); bot.push([al, -be]);
      }
      return top.concat(bot.reverse());
    }
    function render() {
      clear(s); var cx = s.W / 2, cy = s.H / 2, pts = curve();
      s.ctx.strokeStyle = "rgba(22,23,29,0.12)"; s.ctx.beginPath(); s.ctx.moveTo(cx, 12); s.ctx.lineTo(cx, s.H - 12); s.ctx.moveTo(20, cy); s.ctx.lineTo(s.W - 20, cy); s.ctx.stroke();
      s.ctx.fillStyle = "rgba(22,23,29,0.88)"; s.ctx.strokeStyle = GOLD; s.ctx.lineWidth = 2.4;
      s.ctx.beginPath();
      pts.forEach(function (p, i) { var X = cx + p[0] * SC, Y = cy - p[1] * SC; i ? s.ctx.lineTo(X, Y) : s.ctx.moveTo(X, Y); });
      s.ctx.closePath(); s.ctx.fill(); s.ctx.stroke();
      rA(a.toFixed(2)); rD(a < 0.3 ? "near-circular" : a < 0.8 ? "shifting" : "flat-sided D");
    }
    var ro = window.ResizeObserver ? new ResizeObserver(render) : null; if (ro) ro.observe(s.canvas); else window.addEventListener("resize", render);
    setTimeout(render, 30); render();
    sim.running = false; if (sim._playBtn) sim._playBtn.remove();
  }

  // ── registry + mount ───────────────────────────────────────────────
  var SIMS = {
    projectile: projectile, pendulum: pendulum, orbit: orbit, doublependulum: doublependulum, ising: ising,
    spring: spring, nbody: nbody, collisions: collisions, rigidbody: rigidbody, chain: chain, fourier: fourier,
    lorentz: lorentz, efield: efield, fdtd: fdtd, gas: gas, randomwalk: randomwalk,
    schrodinger: schrodinger, eigenstates: eigenstates, lensing: lensing, shadow: shadow
  };

  function mountAll() {
    document.querySelectorAll(".sim[data-sim]").forEach(function (node) {
      if (node.classList.contains("sim-built")) return;
      var fn = SIMS[node.getAttribute("data-sim")];
      if (fn) { try { fn(node); } catch (e) { node.textContent = "(interactive figure failed to load)"; } }
    });
  }
  if (document.readyState !== "loading") mountAll();
  else document.addEventListener("DOMContentLoaded", mountAll);
})();
