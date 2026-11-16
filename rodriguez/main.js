(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  let W, H, DPR, season = 'snow', parts = [], blades = [], mower = null, last = 0;

  // TODO: put the business email here. Quote requests open the visitor's email app.
  const BUSINESS_EMAIL = '';

  if (!reduce) {
    const lenis = new Lenis({ lerp: 0.1 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); lenis.scrollTo(t); }
    }));
  }

  const R = (a, b) => a + Math.random() * (b - a);
  const css = n => getComputedStyle(body).getPropertyValue(n).trim();

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function build() {
    parts = []; blades = []; mower = null;
    const small = W < 700;
    if (season === 'snow') {
      for (let i = 0; i < (small ? 70 : 150); i++) parts.push({ x: R(0, W), y: R(0, H), r: R(1.2, 4.2), v: R(25, 80), d: R(0, 6.28), s: R(.3, 1) });
    } else if (season === 'fall') {
      const cols = ['#b8480f', '#d9822b', '#c0392b', '#8a5a1a', '#e0a526'];
      for (let i = 0; i < (small ? 22 : 45); i++) parts.push({ x: R(0, W), y: R(-H, H), s: R(9, 20), v: R(40, 95), d: R(0, 6.28), rot: R(0, 6.28), vr: R(-1.6, 1.6), c: cols[i % cols.length] });
    } else {
      const n = Math.floor(W / (small ? 7 : 5));
      for (let i = 0; i < n; i++) blades.push({ x: (i / n) * W + R(-2, 2), full: R(70, 150), cut: 1, ph: R(0, 6.28) });
      mower = { x: -120, dir: 1, wait: 40 };
    }
  }

  function leaf(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.moveTo(0, -p.s);
    ctx.bezierCurveTo(p.s * .9, -p.s * .5, p.s * .7, p.s * .6, 0, p.s);
    ctx.bezierCurveTo(-p.s * .7, p.s * .6, -p.s * .9, -p.s * .5, 0, -p.s); ctx.fill();
    ctx.strokeStyle = 'rgba(58,31,13,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(0, p.s); ctx.stroke();
    ctx.restore();
  }

  function frame(t) {
    const dt = Math.min((t - last) / 1000 || 0, .05); last = t;
    ctx.clearRect(0, 0, W, H);
    if (season === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      for (const p of parts) {
        p.y += p.v * dt * p.s * 1.4; p.d += dt; p.x += Math.sin(p.d) * 18 * dt * p.s;
        if (p.y > H + 6) { p.y = -6; p.x = R(0, W); }
        ctx.globalAlpha = .45 + p.s * .55; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, H - 70, 0, H); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.9)');
      ctx.fillStyle = g; ctx.fillRect(0, H - 70, W, 70);
    } else if (season === 'fall') {
      for (const p of parts) {
        p.y += p.v * dt; p.d += dt * 1.3; p.x += Math.sin(p.d) * 45 * dt; p.rot += p.vr * dt;
        if (p.y > H + 30) { p.y = -30; p.x = R(0, W); }
        leaf(p);
      }
    } else {
      const m = mower, speed = Math.max(W / 5, 160);
      if (m.wait > 0) m.wait -= dt * 60; else { m.x += m.dir * speed * dt; if (m.x > W + 140 || m.x < -140) { m.dir *= -1; m.wait = 50; } }
      const col = css('--accent');
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for (const b of blades) {
        const passed = m.dir > 0 ? b.x < m.x : b.x > m.x;
        if (passed && m.wait <= 0) b.cut = Math.max(.28, b.cut - dt * 6);
        else if (m.wait > 0 && ((m.dir > 0 && m.x > W) || (m.dir < 0 && m.x < 0))) b.cut = Math.min(1, b.cut + dt * .4);
        const h = b.full * b.cut, sway = Math.sin(t / 700 + b.ph + b.x * .01) * 10 * b.cut;
        ctx.globalAlpha = .75; ctx.beginPath(); ctx.moveTo(b.x, H); ctx.quadraticCurveTo(b.x + sway * .4, H - h * .55, b.x + sway, H - h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // simple mower: body, handle, wheel
      const y = H - 38; ctx.fillStyle = css('--fg'); ctx.fillRect(m.x - 34, y - 18, 68, 22);
      ctx.fillStyle = col; ctx.fillRect(m.x - 34, y - 26, 44, 9);
      ctx.strokeStyle = css('--fg'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.x - 30 * m.dir, y - 16); ctx.lineTo(m.x - 62 * m.dir, y - 60); ctx.stroke();
      ctx.fillStyle = css('--fg'); ctx.beginPath(); ctx.arc(m.x - 18, y + 6, 9, 0, 6.283); ctx.arc(m.x + 20, y + 6, 9, 0, 6.283); ctx.fill();
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  function select(name, focus) {
    season = name; body.dataset.season = name;
    tabs.forEach(t => {
      const on = t.id === 't-' + name;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    build();
    if (reduce) frame(0);
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.id.slice(2)));
    t.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length].id.slice(2), true); }
    });
  });

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  const form = document.getElementById('quote-form');
  const status = form.querySelector('.status');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form);
    const bad = ['name', 'contact'].filter(k => !String(f.get(k)).trim());
    form.querySelectorAll('input').forEach(i => i.setAttribute('aria-invalid', bad.includes(i.name)));
    if (bad.length) { status.textContent = 'Please add your name and a phone or email so we can reply.'; return; }
    if (!BUSINESS_EMAIL) { status.textContent = 'Quote form is not connected yet. Check back soon.'; return; }
    const lines = [...f.entries()].map(([k, v]) => k + ': ' + v).join('\n');
    location.href = 'mailto:' + BUSINESS_EMAIL + '?subject=' + encodeURIComponent('Quote request: ' + f.get('service')) + '&body=' + encodeURIComponent(lines);
    status.textContent = 'Opening your email app.';
  });
})();
