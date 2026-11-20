/*
 * Figura da seção de pesquisa: dados atravessando um pipeline medallion até um LLM.
 * Os pontos entram dispersos (raw), alinham-se a cada camada e viram resposta;
 * os marcados com × são instruções maliciosas (prompt injection) e caem no guard.
 * É uma ilustração: nada aqui é medição real.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('pipeline');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  const STAGES = ['RAW', 'BRONZE', 'SILVER', 'GOLD', 'GUARD', 'LLM', 'ANSWER'];
  const GUARD = 4;
  const LAST = STAGES.length - 1;
  const JITTER = [30, 17, 7, 0, 0, 0, 0]; // dispersão vertical (px) em cada estágio
  const SPEED = 0.62;                     // estágios por segundo
  const SPAWN_EVERY = 0.15;               // segundos
  const BAD_RATE = 0.13;
  const INK = '236, 236, 236';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let w = 0;
  let h = 0;
  let mid = 0;
  let pad = 0;
  let gap = 0;
  let particles = [];
  let pulses = [];
  let banners = []; // aviso de "barrado" sobre o guard, para ataques disparados pelo visitante
  let spawnIn = 0;
  let last = 0;
  let raf = 0;
  let onScreen = true;

  const xOf = (s) => pad + s * gap;

  function jitterAt(s) {
    const c = Math.min(Math.max(s, 0), LAST);
    const i = Math.min(Math.floor(c), LAST - 1);
    return JITTER[i] + (JITTER[i + 1] - JITTER[i]) * (c - i);
  }

  function spawn(s) {
    particles.push({
      s,
      seed: Math.random() * Math.PI * 2,
      speed: SPEED * (0.85 + Math.random() * 0.3),
      bad: Math.random() < BAD_RATE,
      drop: -1, // >= 0: segundos desde que foi barrado
    });
  }

  function step(dt) {
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn(-0.25);
      spawnIn = SPAWN_EVERY * (0.6 + Math.random() * 0.8);
    }
    for (const p of particles) {
      if (p.drop >= 0) {
        p.drop += dt;
        continue;
      }
      p.s += p.speed * dt;
      if (p.bad && p.s >= GUARD) {
        p.s = GUARD;
        p.drop = 0;
        pulses.push({ age: 0, big: !!p.label });
        if (p.label) banners.push({ age: 0, text: p.blocked });
      }
    }
    for (const pulse of pulses) pulse.age += dt;
    for (const banner of banners) banner.age += dt;
    particles = particles.filter((p) => (p.drop >= 0 ? p.drop < 0.9 : p.s < LAST + 0.2));
    pulses = pulses.filter((pulse) => pulse.age < 0.6);
    banners = banners.filter((banner) => banner.age < 1.6);
  }

  // O visitante dispara uma instrução maliciosa e a vê ser barrada no guard
  function attack(label, blocked) {
    particles.push({
      s: -0.25,
      seed: Math.random() * Math.PI * 2,
      speed: SPEED * 2.1,
      bad: true,
      drop: -1,
      label,
      blocked,
    });
  }

  function drawTrack() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${INK}, 0.16)`;
    ctx.beginPath();
    ctx.moveTo(xOf(0), mid + 0.5);
    ctx.lineTo(xOf(LAST), mid + 0.5);
    ctx.stroke();

    ctx.font = `500 ${w < 520 ? 8.5 : 10.5}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    STAGES.forEach((name, i) => {
      const x = Math.round(xOf(i)) + 0.5;
      const isGuard = i === GUARD;
      const r = isGuard ? 8 : 5;

      // régua vertical da camada
      ctx.strokeStyle = `rgba(${INK}, 0.1)`;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(x, mid - 40);
      ctx.lineTo(x, mid + 40);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#0a0a0a';
      ctx.strokeStyle = `rgba(${INK}, ${isGuard ? 0.95 : 0.6})`;
      ctx.lineWidth = isGuard ? 1.5 : 1;
      ctx.beginPath();
      if (isGuard) {
        ctx.moveTo(x, mid - r);
        ctx.lineTo(x + r, mid);
        ctx.lineTo(x, mid + r);
        ctx.lineTo(x - r, mid);
        ctx.closePath();
      } else {
        ctx.rect(x - r, mid - r + 0.5, r * 2, r * 2);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = `rgba(${INK}, ${isGuard ? 0.95 : 0.6})`;
      ctx.fillText(name, x, h - 8);
    });
  }

  function drawParticles() {
    for (const p of particles) {
      const x = xOf(p.s);
      let y = mid + jitterAt(p.s) * Math.sin(p.seed + p.s * 5);

      if (p.bad) {
        let alpha = 1;
        let px = x;
        if (p.drop >= 0) {
          alpha = 1 - p.drop / 0.9;
          px -= p.drop * 26;
          y += 14 + p.drop * p.drop * 90;
        }
        const r = p.label ? 7 : 4.5;
        const c = r * 0.5;
        ctx.strokeStyle = `rgba(${p.label ? '255, 255, 255' : INK}, ${alpha})`;
        ctx.lineWidth = p.label ? 2 : 1.2;
        ctx.beginPath();
        ctx.arc(px, y, r, 0, Math.PI * 2);
        ctx.moveTo(px - c, y - c);
        ctx.lineTo(px + c, y + c);
        ctx.moveTo(px + c, y - c);
        ctx.lineTo(px - c, y + c);
        ctx.stroke();
        if (p.label && p.drop < 0) {
          ctx.font = `500 ${w < 520 ? 9.5 : 11}px "JetBrains Mono", ui-monospace, monospace`;
          ctx.textAlign = 'center';
          const half = ctx.measureText(p.label).width / 2 + 4;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillText(p.label, Math.min(Math.max(px, half), w - half), Math.max(y - 14, 12));
        }
        continue;
      }

      // o dado ganha nitidez a cada camada e sai maior depois do LLM
      const refined = Math.min(Math.max(p.s / 3, 0), 1);
      const size = p.s > GUARD + 1 ? 5 : 3.5;
      const edge = Math.min(1, (p.s + 0.25) * 4, (LAST + 0.2 - p.s) * 5);
      ctx.fillStyle = `rgba(${INK}, ${(0.35 + 0.65 * refined) * Math.max(edge, 0)})`;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    for (const pulse of pulses) {
      const k = pulse.age / 0.6;
      const r = 8 + k * (pulse.big ? 42 : 16);
      const x = xOf(GUARD);
      ctx.strokeStyle = `rgba(${INK}, ${(pulse.big ? 1 : 0.7) * (1 - k)})`;
      ctx.lineWidth = pulse.big ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, mid - r);
      ctx.lineTo(x + r, mid);
      ctx.lineTo(x, mid + r);
      ctx.lineTo(x - r, mid);
      ctx.closePath();
      ctx.stroke();
    }

    for (const banner of banners) {
      ctx.font = `700 ${w < 520 ? 10 : 12}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, (1.6 - banner.age) * 2)})`;
      ctx.fillText(banner.text, xOf(GUARD), mid - 22 - Math.min(banner.age, 0.4) * 20);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawParticles();
    drawTrack();
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
    last = now;
    step(dt);
    draw();
    schedule();
  }

  function schedule() {
    if (!raf && onScreen && !document.hidden && !reducedMotion.matches) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pad = w < 520 ? 24 : 56;
    gap = (w - 2 * pad) / LAST;
    mid = Math.round((h - 22) / 2);
    draw();
  }

  // começa já povoado, em vez de esperar os primeiros pontos atravessarem
  for (let i = 0; i < 400; i++) step(1 / 30);

  // a figura muda de lugar e começa oculta: redimensiona sempre que a caixa mudar
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  document.getElementById('pipe-attack')?.addEventListener('click', (event) => {
    const { label, blocked } = event.currentTarget.dataset;
    attack(label || 'ignore previous instructions', blocked || 'blocked');
  });
  document.fonts?.ready.then(draw);
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', schedule);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      schedule();
    }).observe(canvas);
  }
  schedule();
})();
