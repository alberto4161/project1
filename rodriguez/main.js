(() => {
  'use strict';

  // Quote requests open the visitor's email app. Put the business address here to switch the form on.
  const BUSINESS_EMAIL = '';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const TAU = Math.PI * 2;
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const token = name => getComputedStyle(root).getPropertyValue(name).trim();
  const pointer = { x: -1e4, y: -1e4 };
  let W = 0, H = 0, season = root.dataset.season || 'snow', scene = null, last = 0, raf = 0, onScreen = true, booted = false;

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Snow. It builds up along the walk, the blower clears it, and it starts falling again.
     Back to front: sky glow, far flakes, street lamp, yard, mid flakes, walk and drift, blower, thrown snow, near flakes. */
  const snow = (() => {
    const STEP = 4;   // width of one column of the drift, in px
    const PAVE = 16;  // thickness of the walk under the snow
    const blower = { x: 0, dir: 1, speed: 0, running: false, timer: 0, end: 0 };
    let S = 1, G = 0, cols = 0, h, target, hold, yard, yardPath, grad = {}, lamp = null, flake = null;
    let far = [], mid = [], near = [], bits = [], clumps = [], ledges = [];
    let t = 0, wind = 0, gust = null, nextGust = 6, measureIn = 0, acc = 0, jet = 0;

    function makeFlake() {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d'), rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.4, 'rgba(255,255,255,.8)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 32, 32);
      return c;
    }
    const flakes = (n, make) => Array.from({ length: n }, () => Object.assign(make(), { x: R(0, W), y: R(0, H), ph: R(0, TAU), w: R(0.5, 1.4), vx: 0, vy: 0 }));
    const col = x => clamp((x / STEP) | 0, 0, cols - 1);
    function reset(f) { f.x = R(-20, W + 20); f.y = -R(4, 50); f.vx = f.vy = 0; }
    function settle(i, amount) {
      for (let k = -2; k <= 2; k++) {
        const j = i + k;
        if (j >= 0 && j < cols) h[j] = Math.min(target[j] * 1.1, h[j] + amount * (1 - Math.abs(k) / 3));
      }
    }

    // The season tabs are ledges: snow settles on top of each pill and can be knocked off.
    function measure() {
      const c = cv.getBoundingClientRect();
      ledges = tabs.map((el, k) => {
        const r = el.getBoundingClientRect(), n = Math.max(2, Math.ceil(r.width / 3)), rad = r.height / 2, old = ledges[k];
        const L = { el, x: r.left - c.left, y: r.top - c.top, w: r.width, n, off: new Float32Array(n), max: new Float32Array(n), cap: old && old.n === n ? old.cap : new Float32Array(n) };
        for (let j = 0; j < n; j++) {
          const lx = j * 3 + 1.5, dx = Math.min(lx, r.width - lx), u = clamp((dx - rad * 0.35) / (rad * 0.8), 0, 1);
          L.off[j] = dx < rad ? rad - Math.sqrt(Math.max(0, rad * rad - (rad - dx) * (rad - dx))) : 0;
          L.max[j] = 8 * S * u * u * (3 - 2 * u) * (0.78 + 0.22 * Math.sin(j * 0.55 + k * 2.1));
        }
        return L;
      });
    }

    function relayout() {
      G = H - PAVE;
      yardPath = new Path2D();
      yardPath.moveTo(0, G + 1);
      for (let i = 0; i < cols; i++) yardPath.lineTo(i * STEP, G - yard[i]);
      yardPath.lineTo(W, G + 1);
      yardPath.closePath();
      const sky = ctx.createLinearGradient(0, G - 420, 0, G);
      sky.addColorStop(0, 'rgba(74,132,190,0)');
      sky.addColorStop(1, 'rgba(74,132,190,.32)');
      const yg = ctx.createLinearGradient(0, G - 96 * S, 0, G);
      yg.addColorStop(0, '#a8bfd6');
      yg.addColorStop(1, '#6d8dae');
      const dg = ctx.createLinearGradient(0, G - 54 * S, 0, G);
      dg.addColorStop(0, '#ffffff');
      dg.addColorStop(1, '#d4e4f2');
      grad = { sky, yard: yg, drift: dg };
      // A street lamp: in the gap between the headline and the service list on wide screens, at the right edge on narrow ones.
      const intro = document.querySelector('.intro'), panels = document.querySelector('.panels'), ground = document.querySelector('.ground');
      const groundTall = ground ? ground.getBoundingClientRect().height : 150;
      lamp = { x: W - 46, top: G - groundTall - 4 };
      if (W >= 900 && intro && panels) {
        const c = cv.getBoundingClientRect(), a = intro.getBoundingClientRect(), b = panels.getBoundingClientRect();
        if (b.left > a.right) lamp = { x: Math.round((a.right + b.left) / 2 - c.left), top: G - groundTall - 28 };
      }
      measure();
    }

    function init(first) {
      S = W < 700 ? 0.74 : 1;
      cols = Math.ceil(W / STEP) + 1;
      h = new Float32Array(cols); target = new Float32Array(cols); hold = new Float32Array(cols); yard = new Float32Array(cols);
      for (let i = 0; i < cols; i++) {
        const x = i * STEP;
        yard[i] = (58 + 18 * Math.sin(x / 210 + 1.3) + 10 * Math.sin(x / 83 + 4.1) + 5 * Math.sin(x / 41)) * S;
        target[i] = (30 + 11 * Math.sin(x / 130 + 0.6) + 6 * Math.sin(x / 47 + 2.2) + 2.5 * Math.sin(x / 19 + 5)) * S;
        h[i] = target[i];
      }
      const k = W < 700 ? 0.65 : 1;
      far = flakes(Math.round(120 * k), () => ({ r: R(0.5, 1.1), v: R(16, 32), sway: R(3, 9), drag: 0.22, a: R(0.25, 0.5) }));
      mid = flakes(Math.round(130 * k), () => ({ r: R(1.1, 2.1), v: R(46, 84), sway: R(9, 20), drag: 0.6, a: R(0.6, 0.92) }));
      near = flakes(Math.round(24 * k), () => ({ r: R(2.6, 5), v: R(118, 185), sway: R(16, 30), drag: 1, a: R(0.45, 0.8) }));
      bits = []; clumps = []; ledges = [];
      t = 0; acc = 0; jet = 0; measureIn = 0;
      blower.running = false; blower.dir = 1; blower.timer = first ? 1.8 : 1.2;
      // Switching to this season from another one arrives on a gust.
      gust = first ? null : { t: 0, dur: 2.2, power: 180 };
      nextGust = R(6, 10);
      flake = flake || makeFlake();
      relayout();
    }

    function move(arr, dt, damp, layer) {
      const px = pointer.x, py = pointer.y;
      for (const f of arr) {
        f.ph += dt * f.w;
        if (layer) {
          // The cursor pushes nearby flakes aside.
          const dx = f.x - px, dy = f.y - py, d2 = dx * dx + dy * dy;
          if (d2 < 10000 && d2 > 4) { const d = Math.sqrt(d2), push = (1 - d / 100) * 1500 * dt / d; f.vx += dx * push; f.vy += dy * push; }
          f.vx *= damp; f.vy *= damp;
        }
        const before = f.y;
        f.x += (Math.sin(f.ph) * f.sway + wind * f.drag + f.vx) * dt;
        f.y += (f.v + f.vy) * dt;
        if (f.x < -24) f.x += W + 48; else if (f.x > W + 24) f.x -= W + 48;
        if (layer === 0) { if (f.y > G - yard[col(f.x)] * 0.6) reset(f); continue; }
        if (layer === 2) { if (f.y > G + 20) reset(f); continue; }
        let landed = false;
        for (const L of ledges) {
          const lx = f.x - L.x;
          if (lx <= 0 || lx >= L.w) continue;
          const j = Math.min(L.n - 1, (lx / 3) | 0), top = L.y + L.off[j] - L.cap[j];
          if (f.y >= top && before <= top + 1) { L.cap[j] = Math.min(L.max[j] * 1.15, L.cap[j] + 0.3); landed = true; break; }
        }
        const i = col(f.x);
        if (!landed && f.y >= G - h[i]) { if (t > hold[i]) settle(i, 0.45); landed = true; }
        if (landed) reset(f);
      }
    }

    function runBlower(dt) {
      const b = blower;
      if (!b.running) {
        jet += (0 - jet) * Math.min(1, dt * 8);
        if ((b.timer -= dt) > 0) return;
        b.speed = Math.max(W / 7.5, 120);
        b.running = true;
        b.x = b.dir > 0 ? -90 * S : W + 90 * S;
        b.end = t + (W + 190 * S) / b.speed;
        return;
      }
      b.x += b.dir * b.speed * dt;
      // The auger housing eats the drift under it. A cleared stretch stays clear until a few seconds after the pass ends.
      const a = b.x + b.dir * 6 * S, c = b.x + b.dir * 52 * S;
      const i0 = Math.max(0, Math.floor(Math.min(a, c) / STEP)), i1 = Math.min(cols - 1, Math.ceil(Math.max(a, c) / STEP));
      let eaten = 0;
      for (let i = i0; i <= i1; i++) {
        const cut = (h[i] - 1) * Math.min(1, dt * 18);
        if (cut > 0) { h[i] -= cut; eaten += cut; }
        hold[i] = b.end + 3;
      }
      jet += (Math.min(1, eaten / 10) - jet) * Math.min(1, dt * 10);
      // What goes in at the front comes out of the chute.
      acc = Math.min(6, acc + Math.min(4, eaten * 0.2));
      const tipX = b.x + b.dir * 3 * S, tipY = G - 92 * S;
      while (acc >= 1 && bits.length < 260) {
        acc -= 1;
        bits.push({ x: tipX + R(-3, 3), y: tipY + R(-3, 3), vx: -b.dir * R(50, 200) * S + wind * 0.25, vy: -R(210, 360) * S, r: R(0.9, 2.5) * S, life: 0, max: R(0.9, 1.5), g: 560 * S });
      }
      if (eaten > 2 && bits.length < 280 && Math.random() < 0.6) {
        bits.push({ x: b.x + b.dir * R(44, 60) * S, y: G - R(4, 36) * S, vx: b.dir * R(10, 70), vy: -R(20, 90), r: R(0.8, 1.8), life: 0, max: R(0.35, 0.7), g: 300 });
      }
      if (b.dir > 0 ? b.x > W + 100 * S : b.x < -100 * S) { b.running = false; b.timer = 11; b.dir *= -1; }
    }

    function step(dt) {
      t += dt;
      // Wind: a slow sway, plus a gust every several seconds.
      let w = Math.sin(t * 0.31) * 14 + Math.sin(t * 0.13 + 2) * 9;
      if (gust) {
        gust.t += dt;
        const k = gust.t / gust.dur;
        if (k >= 1) gust = null; else w += gust.power * Math.sin(Math.PI * k) ** 2;
      } else if ((nextGust -= dt) <= 0) {
        gust = { t: 0, dur: R(1.8, 2.8), power: (Math.random() < 0.5 ? -1 : 1) * R(120, 200) };
        nextGust = R(7, 12);
      }
      wind = w;
      if ((measureIn -= dt) <= 0) { measure(); measureIn = 1; }

      const damp = Math.pow(0.04, dt);
      move(far, dt, damp, 0);
      move(mid, dt, damp, 1);
      move(near, dt, damp, 2);

      // The drift grows back toward its resting shape and keeps a soft edge.
      const grow = 1 - Math.exp(-dt / 4);
      for (let i = 0; i < cols; i++) if (t > hold[i]) h[i] += (target[i] - h[i]) * grow;
      for (let i = 1; i < cols - 1; i++) h[i] += (h[i - 1] + h[i + 1] - 2 * h[i]) * 0.12;

      const capGrow = 1 - Math.exp(-dt / 6);
      for (const L of ledges) for (let j = 0; j < L.n; j++) if (L.cap[j] < L.max[j]) L.cap[j] += (L.max[j] - L.cap[j]) * capGrow;

      runBlower(dt);

      for (let i = bits.length - 1; i >= 0; i--) {
        const p = bits[i];
        p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life > p.max || p.y > G) { bits[i] = bits[bits.length - 1]; bits.pop(); }
      }
      for (let i = clumps.length - 1; i >= 0; i--) {
        const c = clumps[i];
        c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        const k = col(c.x);
        if (c.y >= G - h[k]) { if (t > hold[k]) settle(k, 0.8); clumps[i] = clumps[clumps.length - 1]; clumps.pop(); }
      }
      // A gust lifts fine snow off the top of the yard.
      if (Math.abs(wind) > 70 && bits.length < 300) {
        for (let n = 0; n < 2; n++) {
          const i = (Math.random() * cols) | 0;
          bits.push({ x: i * STEP, y: G - Math.max(yard[i], h[i]) - 1, vx: wind * R(0.7, 1.2), vy: -R(4, 26), r: R(0.6, 1.3), life: 0, max: R(0.5, 1), g: 40 });
        }
      }
    }

    function paintFlakes(arr, layer) {
      const streak = layer === 1 && Math.abs(wind) > 60;
      ctx.lineCap = 'round';
      for (const f of arr) {
        let a = f.a, warm = false;
        if (lamp && f.y > lamp.top) {
          const k = 1 - Math.abs(f.x - lamp.x) / (14 + (f.y - lamp.top) * 0.42);
          if (k > 0) { a = Math.min(1, a + k * 0.6); warm = k > 0.12; }
        }
        ctx.globalAlpha = a;
        if (layer === 2) { const d = f.r * 3.4; ctx.drawImage(flake, f.x - d / 2, f.y - d / 2, d, d); continue; }
        const color = warm ? '#ffe8be' : '#ffffff';
        if (streak) {
          ctx.strokeStyle = color; ctx.lineWidth = f.r * 1.8;
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - wind * f.drag * 0.035, f.y - f.v * 0.035); ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function paintLampLight() {
      const reach = G - lamp.top;
      const cone = ctx.createLinearGradient(0, lamp.top, 0, G);
      cone.addColorStop(0, 'rgba(255,224,170,.13)');
      cone.addColorStop(1, 'rgba(255,224,170,.02)');
      ctx.fillStyle = cone;
      for (const k of [0.42, 0.3, 0.18]) {
        const spread = 14 + reach * k;
        ctx.beginPath();
        ctx.moveTo(lamp.x - 8, lamp.top + 10); ctx.lineTo(lamp.x + 8, lamp.top + 10);
        ctx.lineTo(lamp.x + spread, G); ctx.lineTo(lamp.x - spread, G);
        ctx.closePath(); ctx.fill();
      }
    }

    function paintLamp() {
      const x = lamp.x, top = lamp.top, base = G - yard[col(x)] + 8;
      // Pool of light on the yard.
      ctx.save(); ctx.clip(yardPath);
      const pool = ctx.createRadialGradient(x, base, 4, x, base, 180);
      pool.addColorStop(0, 'rgba(255,228,178,.6)');
      pool.addColorStop(1, 'rgba(255,228,178,0)');
      ctx.fillStyle = pool; ctx.fillRect(x - 190, G - 130, 380, 130);
      ctx.restore();
      // Post and lantern.
      ctx.strokeStyle = '#3d556e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top + 16); ctx.stroke();
      const halo = ctx.createRadialGradient(x, top + 8, 2, x, top + 8, 58);
      halo.addColorStop(0, 'rgba(255,236,196,.7)');
      halo.addColorStop(1, 'rgba(255,236,196,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, top + 8, 58, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff1cf'; roundRect(x - 8, top + 1, 16, 15, 4); ctx.fill();
      ctx.fillStyle = '#3d556e'; roundRect(x - 13, top - 4, 26, 6, 3); ctx.fill();
      ctx.fillStyle = '#f4f9fd'; ctx.beginPath(); ctx.ellipse(x, top - 4, 12, 4.5, 0, Math.PI, 0); ctx.fill();
    }

    function paintBlower() {
      const b = blower;
      ctx.save();
      ctx.translate(b.x, G);
      ctx.scale(b.dir * S, S); // drawn facing right; flipped for the return pass
      // Headlight beam.
      const beam = ctx.createLinearGradient(46, 0, 230, 0);
      beam.addColorStop(0, 'rgba(255,228,170,.42)');
      beam.addColorStop(1, 'rgba(255,228,170,0)');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(44, -58); ctx.lineTo(230, -96); ctx.lineTo(230, 0); ctx.lineTo(44, -48); ctx.closePath(); ctx.fill();
      // Snow leaving the chute.
      if (jet > 0.05) {
        const jg = ctx.createLinearGradient(3, -92, -56, -148);
        jg.addColorStop(0, `rgba(255,255,255,${0.9 * jet})`);
        jg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = jg; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(3, -92); ctx.quadraticCurveTo(-22, -128, -58, -146); ctx.stroke();
      }
      // Handles.
      ctx.strokeStyle = '#526a83'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(-58, -86); ctx.lineTo(-74, -86); ctx.stroke();
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-30, -24); ctx.lineTo(-50, -74); ctx.stroke();
      // Chute.
      ctx.strokeStyle = '#c53a22'; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(22, -50); ctx.lineTo(22, -66); ctx.quadraticCurveTo(22, -88, 3, -92); ctx.stroke();
      // Engine and auger housing.
      ctx.fillStyle = '#31465c'; roundRect(-26, -61, 26, 14, 4); ctx.fill();
      ctx.fillStyle = '#e04a2c'; roundRect(-36, -50, 50, 34, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -52); ctx.lineTo(36, -52); ctx.quadraticCurveTo(52, -50, 52, -32); ctx.lineTo(52, -2); ctx.lineTo(12, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; roundRect(-32, -47, 42, 4, 2); ctx.fill();
      // Auger mouth, with the flights turning.
      ctx.fillStyle = '#7d2212'; roundRect(40, -46, 12, 44, 3); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(40, -46, 12, 44); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = 2.2;
      const turn = (t * 3.2) % 1;
      for (let k = -1; k < 4; k++) { const y = -46 + (k + turn) * 14; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(52, y + 8); ctx.stroke(); }
      ctx.restore();
      // Wheel, rolling.
      ctx.fillStyle = '#0b1118'; ctx.beginPath(); ctx.arc(-12, -14, 14, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(-12, -14); ctx.rotate(b.x * b.dir / (14 * S));
      ctx.strokeStyle = '#8ea3b8'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
      ctx.fillStyle = '#8ea3b8'; ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
      ctx.restore();
      // Headlight.
      ctx.fillStyle = '#fff3cf'; ctx.beginPath(); ctx.arc(44, -55, 3.6, 0, TAU); ctx.fill();
      ctx.restore();
    }

    function paintCaps() {
      ctx.fillStyle = '#f6fafe';
      for (const L of ledges) {
        ctx.beginPath();
        ctx.moveTo(L.x + 1.5, L.y + L.off[0] + 2);
        for (let j = 0; j < L.n; j++) ctx.lineTo(L.x + j * 3 + 1.5, L.y + L.off[j] - L.cap[j]);
        for (let j = L.n - 1; j >= 0; j--) ctx.lineTo(L.x + j * 3 + 1.5, L.y + L.off[j] + 2);
        ctx.closePath(); ctx.fill();
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = grad.sky; ctx.fillRect(0, G - 420, W, 420);
      paintFlakes(far, 0);
      if (lamp) paintLampLight();
      ctx.fillStyle = grad.yard; ctx.fill(yardPath);
      if (lamp) paintLamp();
      paintFlakes(mid, 1);
      // The walk, then the drift lying on it.
      ctx.fillStyle = '#2b3948'; ctx.fillRect(0, G, W, PAVE);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(0, G, W, 1.5);
      if (lamp) {
        const shine = ctx.createRadialGradient(lamp.x, G, 2, lamp.x, G, 170);
        shine.addColorStop(0, 'rgba(255,226,176,.34)');
        shine.addColorStop(1, 'rgba(255,226,176,0)');
        ctx.fillStyle = shine; ctx.fillRect(lamp.x - 170, G, 340, PAVE);
      }
      ctx.beginPath(); ctx.moveTo(0, G);
      for (let i = 0; i < cols; i++) ctx.lineTo(i * STEP, G - h[i]);
      ctx.lineTo(W, G); ctx.closePath();
      ctx.fillStyle = grad.drift; ctx.fill();
      if (blower.running) paintBlower();
      ctx.fillStyle = '#ffffff';
      for (const p of bits) { ctx.globalAlpha = clamp(1 - p.life / p.max, 0, 1) * 0.92; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const c of clumps) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill(); }
      paintCaps();
      paintFlakes(near, 2);
    }

    // Reduced motion: one composed frame, with the blower part-way through a pass.
    function still() {
      blower.running = true; blower.dir = 1; blower.x = W * 0.36;
      for (let i = 0; i < cols; i++) h[i] = i * STEP < blower.x + 50 * S ? 1 : target[i];
      for (const L of ledges) L.cap.set(L.max);
      draw();
    }

    // Knock the snow off a tab.
    function shed(el) {
      const L = ledges.find(l => l.el === el);
      if (!L) return;
      for (let j = 0; j < L.n; j += 2) {
        const c = L.cap[j];
        if (c > 0.8) clumps.push({ x: L.x + j * 3, y: L.y + L.off[j] - c / 2, vx: (j < L.n / 2 ? -1 : 1) * R(15, 70), vy: -R(40, 120), r: clamp(c * 0.5, 1, 3) });
      }
      L.cap.fill(0);
    }

    return { init, relayout, step, draw, still, shed };
  })();

  /* Fall: leaves coming down. */
  const fall = (() => {
    const COLORS = ['#b8480f', '#d9822b', '#c0392b', '#8a5a1a', '#e0a526'];
    let leaves = [];
    function init() {
      const n = W < 700 ? 22 : 45;
      leaves = Array.from({ length: n }, (_, i) => ({ x: R(0, W), y: R(-H * 0.3, H), s: R(9, 20), v: R(40, 95), d: R(0, TAU), rot: R(0, TAU), vr: R(-1.6, 1.6), c: COLORS[i % COLORS.length] }));
    }
    function step(dt) {
      for (const p of leaves) {
        p.y += p.v * dt; p.d += dt * 1.3; p.x += Math.sin(p.d) * 45 * dt; p.rot += p.vr * dt;
        if (p.y > H + 30) { p.y = -30; p.x = R(0, W); }
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of leaves) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.moveTo(0, -p.s);
        ctx.bezierCurveTo(p.s * 0.9, -p.s * 0.5, p.s * 0.7, p.s * 0.6, 0, p.s);
        ctx.bezierCurveTo(-p.s * 0.7, p.s * 0.6, -p.s * 0.9, -p.s * 0.5, 0, -p.s);
        ctx.fill();
        ctx.strokeStyle = 'rgba(58,31,13,.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(0, p.s); ctx.stroke();
        ctx.restore();
      }
    }
    return { init, step, draw, still: draw };
  })();

  /* Lawn: a mower works across, and the grass grows back before the next pass. */
  const lawn = (() => {
    let blades = [], m = null, accent = '', ink = '', t = 0;
    function init() {
      const n = Math.floor(W / (W < 700 ? 7 : 5));
      blades = Array.from({ length: n }, (_, i) => ({ x: (i / n) * W + R(-2, 2), full: R(70, 150), cut: 1, ph: R(0, TAU) }));
      m = { x: -120, dir: 1, wait: 0.7 };
      accent = token('--accent'); ink = token('--fg'); t = 0;
    }
    function step(dt) {
      t += dt;
      if (m.wait > 0) {
        m.wait -= dt;
        for (const b of blades) b.cut = Math.min(1, b.cut + dt * 0.3);
        return;
      }
      m.x += m.dir * Math.max(W / 5, 160) * dt;
      for (const b of blades) if (m.dir > 0 ? b.x < m.x : b.x > m.x) b.cut = Math.max(0.28, b.cut - dt * 6);
      if (m.x > W + 140 || m.x < -140) { m.dir *= -1; m.wait = 5; }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = accent; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.globalAlpha = 0.75;
      for (const b of blades) {
        const tall = b.full * b.cut, sway = Math.sin(t / 0.7 + b.ph + b.x * 0.01) * 10 * b.cut;
        ctx.beginPath(); ctx.moveTo(b.x, H); ctx.quadraticCurveTo(b.x + sway * 0.4, H - tall * 0.55, b.x + sway, H - tall); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const y = H - 38;
      ctx.fillStyle = ink; ctx.fillRect(m.x - 34, y - 18, 68, 22);
      ctx.fillStyle = accent; ctx.fillRect(m.x - 34, y - 26, 44, 9);
      ctx.strokeStyle = ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(m.x - 30 * m.dir, y - 16); ctx.lineTo(m.x - 62 * m.dir, y - 60); ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(m.x - 18, y + 6, 9, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(m.x + 20, y + 6, 9, 0, TAU); ctx.fill();
    }
    function still() {
      m.x = W * 0.4; m.wait = 0;
      for (const b of blades) b.cut = b.x < m.x ? 0.28 : 1;
      draw();
    }
    return { init, step, draw, still };
  })();

  const scenes = { snow, fall, lawn };

  function setup(first) {
    scene = scenes[season];
    scene.init(first);
    if (reduce) scene.still(); else scene.draw();
  }

  function fit() {
    const w = cv.clientWidth, tall = cv.clientHeight;
    if (!w || !tall) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), widthChanged = w !== W;
    W = w; H = tall;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (widthChanged || !booted) { setup(!booted); booted = true; }
    else {
      if (scene.relayout) scene.relayout();
      if (reduce) scene.still(); else scene.draw();
    }
    play();
  }

  function tick(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    scene.step(dt);
    scene.draw();
    play();
  }
  // The loop only runs while the scene is on screen and the tab is visible.
  function play() { if (!raf && !reduce && scene && onScreen && !document.hidden) raf = requestAnimationFrame(tick); }

  function select(name, focus) {
    tabs.forEach(tab => {
      const on = tab.id === 't-' + name;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) tab.focus();
    });
    if (name === season) return;
    season = name;
    root.dataset.season = name;
    root.dataset.switched = '';
    setup(false);
    play();
  }

  tabs.forEach((tab, i) => {
    const name = tab.id.slice(2);
    tab.addEventListener('click', () => {
      if (name === 'snow' && season === 'snow' && !reduce) snow.shed(tab);
      select(name);
    });
    tab.addEventListener('pointerenter', () => { if (season === 'snow' && !reduce) snow.shed(tab); });
    tab.addEventListener('keydown', e => {
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      select(tabs[(to + tabs.length) % tabs.length].id.slice(2), true);
    });
  });

  fit();
  new ResizeObserver(fit).observe(cv);
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; play(); }).observe(cv);
  document.addEventListener('visibilitychange', play);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (scene && scene.relayout) scene.relayout(); });

  if (!reduce) {
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = cv.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e4; });

    if (window.Lenis) {
      const lenis = new Lenis({ lerp: 0.1 });
      const loop = time => { lenis.raf(time); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', e => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: target.id === 'top' ? 0 : -72 }); }
      }));
    }
  }

  const form = document.getElementById('quote-form');
  const status = form.querySelector('.status');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const missing = ['name', 'contact'].filter(key => !String(data.get(key)).trim());
    form.querySelectorAll('input').forEach(input => input.setAttribute('aria-invalid', String(missing.includes(input.name))));
    if (missing.length) {
      status.dataset.state = 'error';
      status.textContent = 'Add your name and a phone number or email so we can reply.';
      form.querySelector(`[name="${missing[0]}"]`).focus();
      return;
    }
    status.dataset.state = '';
    if (!BUSINESS_EMAIL) { status.textContent = 'This form is not switched on yet. Check back soon.'; return; }
    const lines = [...data.entries()].map(([key, value]) => key + ': ' + value).join('\n');
    location.href = 'mailto:' + BUSINESS_EMAIL + '?subject=' + encodeURIComponent('Quote request: ' + data.get('service')) + '&body=' + encodeURIComponent(lines);
    status.textContent = 'Opening your email app.';
  });
})();
