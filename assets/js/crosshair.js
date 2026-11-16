/*
 * Mira estilo prancheta: linha horizontal + vertical seguindo o ponteiro,
 * com as coordenadas da página (x/y, contando o scroll) ao lado.
 * Só é ativada em dispositivos com mouse; em touch fica desligada.
 */
(() => {
  'use strict';

  const OFFSET = 14;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, '0');

  let root = null;
  let hLine, vLine, label;
  let x = 0;
  let y = 0;
  let framePending = false;

  function build() {
    root = document.createElement('div');
    root.className = 'xh';
    root.setAttribute('aria-hidden', 'true');
    hLine = document.createElement('div');
    hLine.className = 'xh__h';
    vLine = document.createElement('div');
    vLine.className = 'xh__v';
    label = document.createElement('div');
    label.className = 'xh__label';
    root.append(hLine, vLine, label);
    document.body.append(root);
  }

  function draw() {
    framePending = false;
    hLine.style.transform = `translateY(${y}px)`;
    vLine.style.transform = `translateX(${x}px)`;
    label.textContent = `x:${pad(x + scrollX)} y:${pad(y + scrollY)}`;

    // o rótulo troca de lado perto das bordas para não sair da tela
    const w = label.offsetWidth;
    const h = label.offsetHeight;
    const lx = x + OFFSET + w > innerWidth ? x - OFFSET - w : x + OFFSET;
    const ly = y + OFFSET + h > innerHeight ? y - OFFSET - h : y + OFFSET;
    label.style.transform = `translate(${lx}px, ${ly}px)`;
  }

  function schedule() {
    if (!framePending) {
      framePending = true;
      requestAnimationFrame(draw);
    }
  }

  function show() { root.classList.add('is-visible'); }
  function hide() { root.classList.remove('is-visible'); }

  function onMove(event) {
    if (event.pointerType === 'touch') return;
    x = event.clientX;
    y = event.clientY;
    show();
    schedule();
  }

  function onScroll() {
    if (root.classList.contains('is-visible')) schedule();
  }

  function enable() {
    if (!root) build();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.documentElement.addEventListener('mouseleave', hide);
    window.addEventListener('blur', hide);
  }

  function disable() {
    if (!root) return;
    hide();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', onScroll);
    document.documentElement.removeEventListener('mouseleave', hide);
    window.removeEventListener('blur', hide);
  }

  const sync = () => (finePointer.matches ? enable() : disable());
  finePointer.addEventListener('change', sync);
  sync();
})();
