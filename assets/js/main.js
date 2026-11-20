/*
 * Renderiza o portfólio a partir de data/cv.json e alterna PT/EN.
 * Todo o conteúdo vive no JSON; este arquivo só sabe montar as seções.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'lang';
  const showDrafts = new URLSearchParams(location.search).has('draft');

  let cv = null;
  let lang = initialLang();
  let revealer = null;

  function initialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'pt' || saved === 'en') return saved;
    } catch (_) { /* storage indisponível: segue para o idioma do navegador */ }
    return (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
  }

  function saveLang() {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignora */ }
  }

  // Texto traduzível: string simples ou { pt, en }
  const t = (v) => (v == null ? '' : typeof v === 'object' ? (v[lang] ?? v.pt ?? '') : String(v));

  // Itens com "draft": true só aparecem com ?draft na URL
  const visible = (list) => (list || []).filter((item) => showDrafts || !item.draft);

  const pad2 = (n) => String(n).padStart(2, '0');

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false || child === '') continue;
      node.append(child);
    }
    return node;
  }

  const external = (href, ...children) =>
    el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, ...children);

  const date = (value) =>
    el('p', { class: `entry__date${value ? '' : ' is-empty'}` }, value || '—');

  // Lista de tags; `solid` (opcional) entra primeiro, em destaque
  function chips(items, solid) {
    const list = (items || []).map((item) => el('li', { class: 'chip' }, t(item)));
    if (solid) list.unshift(el('li', { class: 'chip chip--solid' }, t(solid)));
    return list.length ? el('ul', { class: 'chips' }, list) : null;
  }

  const bullets = (items) =>
    items?.length ? el('ul', { class: 'bullets' }, items.map((item) => el('li', null, t(item)))) : null;

  const label = (n, key) =>
    el('h2', { class: 'label' }, `[ ${pad2(n)} / ${t(cv.ui.sections[key])} ]`);

  // Link de um caso: "link" (página externa) tem precedência sobre "repo"
  function caseLink(item, cls) {
    const href = item.link || item.repo;
    return href
      ? el('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer' },
          `${item.link ? t(cv.ui.open) : t(cv.ui.repo)} ↗`)
      : null;
  }

  /* ---------------------------------------------------------------- seções */

  // Casos: os em destaque viram estudo de caso; os "compact" viram cartão
  function renderCases(items) {
    const full = items.filter((item) => !item.compact);
    const compact = items.filter((item) => item.compact);

    const studies = full.map((item, i) =>
      el('article', { class: `case${item.draft ? ' draft' : ''}` },
        el('header', { class: 'case__head' },
          el('p', { class: 'case__meta' }, [pad2(i + 1), ...(item.meta || []).map(t)].join(' · ')),
          el('h3', { class: 'case__title' }, t(item.title)),
          el('p', { class: 'case__org' }, [t(item.org), t(item.role)].filter(Boolean).join(' — '))),
        el('div', { class: 'case__body' },
          el('div', { class: 'case__main' },
            el('p', { class: 'case__context' }, t(item.context)),
            item.quote ? el('blockquote', { class: 'case__quote' }, `“${t(item.quote)}”`) : null,
            bullets(item.built),
            item.result
              ? el('p', { class: 'case__result' }, el('strong', null, `${t(cv.ui.result)}: `), t(item.result))
              : null,
            caseLink(item, 'case__link')),
          el('aside', { class: 'case__side' },
            item.flow?.length
              ? el('div', null,
                  el('p', { class: 'case__sidelabel' }, t(cv.ui.flow)),
                  el('ol', { class: 'flow' }, item.flow.map((node) => el('li', null, t(node)))),
                  item.flowNote ? el('p', { class: 'flow__note' }, t(item.flowNote)) : null)
              : null,
            chips(item.stack)))));

    const more = compact.length
      ? [
          el('h3', { class: 'sublabel' }, t(cv.ui.moreWork)),
          el('div', { class: 'projects' }, compact.map((item) =>
            el('article', { class: `card${item.draft ? ' draft' : ''}` },
              el('div', { class: 'card__head' },
                el('h4', { class: 'card__name' }, t(item.title)),
                caseLink(item, 'card__link')),
              el('p', { class: 'card__desc' }, t(item.context)),
              chips(item.stack)))),
        ]
      : [];

    return el('div', { class: 'cases' }, studies, more);
  }

  // Como eu trabalho: { title, text, proof }
  function renderPrinciples(items) {
    return el('div', { class: 'principles' }, items.map((item, i) =>
      el('article', { class: `card pillar${item.draft ? ' draft' : ''}` },
        el('p', { class: 'pillar__index' }, pad2(i + 1)),
        el('h3', { class: 'pillar__title' }, t(item.title)),
        el('p', { class: 'card__desc' }, t(item.text)),
        item.proof ? el('p', { class: 'pillar__proof' }, `↳ ${t(item.proof)}`) : null)));
  }

  // Pesquisa: { date, title, venue, description, link, stack }
  function renderListing(items) {
    return el('div', null, items.map((item) =>
      el('article', { class: `entry${item.draft ? ' draft' : ''}` },
        date(t(item.date)),
        el('div', null,
          el('h3', { class: 'entry__title' }, item.link ? external(item.link, t(item.title), ' ↗') : t(item.title)),
          item.venue ? el('p', { class: 'entry__org' }, t(item.venue)) : null,
          item.description ? el('p', { class: 'entry__desc' }, t(item.description)) : null,
          chips(item.stack)))));
  }

  // Formação, certificações e palestras: os itens de estudo da linha do tempo, do mais recente ao mais antigo
  // (em andamento primeiro); "verify" aponta para a credencial verificável (Credly, Open Badge...)
  const endOf = (item) => (item.status ? '9999' : String(item.to ?? item.from ?? ''));

  // "2026-07" → "07/2026"
  const monthYear = (value) => (value ? String(value).split('-').reverse().join('/') : '');

  // Uma certificação da lista detalhada: { title, issuer, date, valid, note, verify }
  const certRow = (item) =>
    el('li', { class: `cert${item.draft ? ' draft' : ''}` },
      el('p', { class: 'cert__date' }, monthYear(item.date)),
      el('div', null,
        el('h4', { class: 'cert__title' }, t(item.title)),
        el('p', { class: 'cert__org' }, [
          t(item.issuer),
          item.valid ? `${t(cv.ui.validUntil)} ${monthYear(item.valid)}` : '',
          t(item.note),
        ].filter(Boolean).join(' · '))),
      item.verify ? el('p', { class: 'cert__link' }, external(item.verify, `${t(cv.ui.verify)} ↗`)) : null);

  function renderCredentials(items) {
    const sorted = [...items].sort((a, b) => endOf(b).localeCompare(endOf(a)));
    const certs = visible(cv.certifications);
    const cards = el('div', { class: 'creds' }, sorted.map((item) => {
      const href = item.verify || item.link;
      return el('article', { class: `card cred${item.status ? ' is-current' : ''}${item.draft ? ' draft' : ''}` },
        item.kind ? el('p', { class: 'cred__kind' }, t(item.kind)) : null,
        el('h3', { class: 'cred__title' }, t(item.title)),
        el('p', { class: 'cred__org' }, [t(item.org), t(item.period)].filter(Boolean).join(' · ')),
        item.note ? el('p', { class: 'card__desc' }, t(item.note)) : null,
        chips(item.stack, item.status),
        href
          ? el('p', { class: 'cred__link' }, external(href, `${t(item.verify ? cv.ui.verify : cv.ui.open)} ↗`))
          : null);
    }));
    return el('div', null,
      cards,
      certs.length
        ? [el('h3', { class: 'sublabel' }, t(cv.ui.certifications)), el('ul', { class: 'certs' }, certs.map(certRow))]
        : null);
  }

  // Recomendações: { quote, name, role, link } — só com autorização de quem escreveu
  function renderTestimonials(items) {
    return el('div', { class: 'quotes' }, items.map((item) =>
      el('figure', { class: `card quote${item.draft ? ' draft' : ''}` },
        el('blockquote', { class: 'quote__text' }, `“${t(item.quote)}”`),
        el('figcaption', { class: 'quote__by' },
          el('strong', null, item.link ? external(item.link, t(item.name)) : t(item.name)),
          item.role ? ` — ${t(item.role)}` : null))));
  }

  function renderSkills(groups) {
    return el('div', { class: 'skills' }, groups.map((group) =>
      el('div', { class: 'skills__group' },
        el('h3', { class: 'skills__label' }, t(group.label)),
        chips(group.items))));
  }

  /* ---------------------------------------------------------------- página */

  const profileLinks = () =>
    cv.profile.links.map((link) => el('li', null, external(link.url, `${t(link.label)} ↗`)));

  // E-mail é o caminho mais curto até a conversa: só aparece se profile.email existir
  const emailLink = (primary) =>
    cv.profile.email
      ? el('li', null, el('a', { class: primary ? 'is-primary' : null, href: `mailto:${cv.profile.email}` },
          `${t(cv.ui.email)} →`))
      : null;

  // "2017-08" ou "2022" → ano em que o item entra na linha do tempo
  const yearOf = (value) => (value ? Number(String(value).split('-')[0]) : null);

  // Um item da linha do tempo: à vista, título, empresa/instituição e período (início — fim);
  // tecnologias e observações aparecem ao passar o mouse, focar ou tocar
  function timelineItem(item) {
    const org = t(item.org);
    const [orgName] = org.split(' · ');
    // o tipo ("Formação") sozinho não justifica um cartão: precisa haver algo a mais para mostrar
    const extra = [
      org !== orgName ? el('p', { class: 'tl__note' }, org) : null,
      item.note ? el('p', { class: 'tl__note' }, t(item.note)) : null,
      chips(item.stack, item.status),
      item.link ? el('p', { class: 'tl__more' }, external(item.link, `${t(cv.ui.open)} ↗`)) : null,
    ].filter(Boolean);
    const details = extra.length
      ? [item.kind ? el('p', { class: 'tl__meta' }, t(item.kind)) : null, ...extra].filter(Boolean)
      : [];
    return el('article', {
        class: `tl__item${item.status ? ' is-current' : ''}${details.length ? ' has-pop' : ''}${item.draft ? ' draft' : ''}`,
        tabindex: details.length ? '0' : null,
      },
      el('h3', { class: 'tl__title' }, t(item.title)),
      orgName ? el('p', { class: 'tl__org' }, orgName) : null,
      el('p', { class: 'tl__period' }, t(item.period)),
      details.length ? el('div', { class: 'tl__pop' }, details) : null);
  }

  // Linha do tempo horizontal: uma coluna por ano de início, trabalho acima do eixo e estudo abaixo
  function renderTimeline() {
    const ui = cv.ui.timeline;
    const byYear = new Map();
    for (const lane of ['work', 'study']) {
      for (const item of visible(cv.timeline[lane])) {
        const year = yearOf(item.from) ?? yearOf(item.to);
        if (!year) continue;
        if (!byYear.has(year)) byYear.set(year, { work: [], study: [] });
        byYear.get(year)[lane].push(item);
      }
    }
    const cols = [...byYear.entries()].sort(([a], [b]) => a - b);
    const cell = (lane, items, i) =>
      el('div', {
        class: `tl__cell tl__cell--${lane}${i >= cols.length - 2 ? ' tl__cell--end' : ''}`,
        style: `grid-column: ${i + 1}`,
      }, items.map(timelineItem));
    const host = document.getElementById('timeline');
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', t(ui.label));
    host.replaceChildren(
      el('p', { class: 'tl__hint' },
        el('span', null, `↑ ${t(ui.work)}`),
        el('span', null, `↓ ${t(ui.study)}`),
        el('span', null, `● ${t(ui.current)}`),
        el('span', null,
          el('span', { class: 'tl__hint-mouse' }, t(ui.hint)),
          el('span', { class: 'tl__hint-touch' }, t(ui.hintTouch)))),
      el('div', { class: 'tl__frame' }, el('div', { class: 'tl__scroll' },
        el('div', { class: 'tl__grid', style: `--cols: ${cols.length}` },
          // o ano vem primeiro no DOM (ordem de leitura); a posição visual é dada pelo grid
          cols.flatMap(([year, col], i) => [
            el('h2', { class: 'tl__year', style: `grid-column: ${i + 1}` }, el('span', null, String(year))),
            cell('work', col.work, i),
            cell('study', col.study, i),
          ])))));

    // em tela estreita a linha do tempo rola de lado: abre no fim, onde está o mais recente,
    // e o degradê das bordas indica para que lado ainda há conteúdo
    const frame = host.querySelector('.tl__frame');
    const scroller = host.querySelector('.tl__scroll');
    const edges = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      frame.classList.toggle('has-before', scroller.scrollLeft > 4);
      frame.classList.toggle('has-after', scroller.scrollLeft < max - 4);
    };
    scroller.scrollLeft = scroller.scrollWidth;
    scroller.onscroll = edges;
    edges();
  }

  function renderHero() {
    const { profile } = cv;
    document.getElementById('hero-name').textContent = profile.name;
    document.getElementById('hero-roles').replaceChildren(...profile.roles.map((role) => el('li', null, t(role))));
    const pitch = document.getElementById('hero-pitch');
    pitch.textContent = t(profile.pitch);
    pitch.hidden = !profile.pitch;
    document.getElementById('hero-links').replaceChildren(...[
      el('li', null, el('a', { class: 'is-primary', href: '#cases' }, `${t(cv.ui.seeCases)} ↓`)),
      emailLink(false),
      ...profileLinks(),
    ].filter(Boolean));
    renderTimeline();
  }

  // Em números: a prova rápida logo abaixo da abertura — { value, label }
  function renderProof() {
    const host = document.getElementById('proof');
    const items = visible(cv.highlights);
    host.hidden = !items.length;
    host.setAttribute('aria-label', t(cv.ui.proof));
    host.replaceChildren(...items.map((item) =>
      el('li', { class: `proof__item${item.draft ? ' draft' : ''}` },
        el('strong', { class: 'proof__value' }, t(item.value)),
        el('span', { class: 'proof__label' }, t(item.label)))));
  }

  // A figura do pipeline é um nó fixo do HTML: só muda de lugar e de idioma
  function placePipeline() {
    const pipe = document.getElementById('pipe');
    const research = document.getElementById('research');
    pipe.hidden = !research;
    if (!research) return;
    research.append(pipe);
    document.getElementById('pipeline').setAttribute('aria-label', t(cv.ui.pipeline.alt));
    document.getElementById('pipe-caption').textContent = t(cv.ui.pipeline.caption);
    document.getElementById('pipe-legend').textContent = t(cv.ui.pipeline.legend);
    const attack = document.getElementById('pipe-attack');
    attack.textContent = `⊗ ${t(cv.ui.pipeline.attack)}`;
    attack.dataset.label = t(cv.ui.pipeline.attackLabel);
    attack.dataset.blocked = t(cv.ui.pipeline.blocked);
  }

  function renderContact(n) {
    document.getElementById('contact').hidden = false;
    document.getElementById('contact-label').textContent = `[ ${pad2(n)} / ${t(cv.ui.sections.contact)} ]`;
    document.getElementById('contact-title').textContent = t(cv.contact.title);
    document.getElementById('contact-text').textContent = t(cv.contact.text);
    document.getElementById('contact-links').replaceChildren(...[emailLink(true), ...profileLinks()].filter(Boolean));
  }

  // As seções surgem ao entrar na tela; sem suporte (ou com menos movimento), ficam visíveis
  function reveal() {
    revealer?.disconnect();
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    revealer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        revealer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.case, .card, .entry, .proof').forEach((node) => {
      node.classList.add('reveal');
      revealer.observe(node);
    });
  }

  function render() {
    // "from": seção que reaproveita outra lista do JSON (formação vem da linha do tempo;
    // os itens "summary" só resumem certificações na linha do tempo e ficam de fora)
    const sections = [
      { key: 'cases', build: renderCases },
      { key: 'credentials', build: renderCredentials, from: () => (cv.timeline?.study || []).filter((item) => !item.summary) },
      { key: 'testimonials', build: renderTestimonials },
      { key: 'principles', build: renderPrinciples },
      { key: 'research', build: renderListing },
      { key: 'skills', build: renderSkills },
    ].map((s) => ({ ...s, items: visible(s.from ? s.from() : cv[s.key]) })).filter((s) => s.items.length > 0);

    renderHero();
    renderProof();

    // tira a figura do pipeline antes de trocar as seções, para o canvas sobreviver
    document.querySelector('.page').append(document.getElementById('pipe'));
    document.getElementById('sections').replaceChildren(...sections.map((s, i) =>
      el('section', { class: 'section', id: s.key },
        label(i + 1, s.key),
        cv.ui.leads?.[s.key] ? el('p', { class: 'section__lead' }, t(cv.ui.leads[s.key])) : null,
        s.build(s.items))));

    placePipeline();
    renderContact(sections.length + 1);

    document.getElementById('nav').setAttribute('aria-label', t(cv.ui.navLabel));
    document.getElementById('nav').replaceChildren(...['timeline', ...sections.map((s) => s.key), 'contact'].map((key) =>
      el('a', { href: `#${key}` }, t(cv.ui.nav?.[key] ?? cv.ui.sections[key]))));

    document.getElementById('footer-copy').textContent =
      `© ${new Date().getFullYear()} ${cv.profile.name} — ${t(cv.ui.footer)}`;

    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = t(cv.ui.pageTitle);

    const toggle = document.getElementById('lang-toggle');
    toggle.setAttribute('aria-label', t(cv.ui.switchTo));
    toggle.querySelectorAll('[data-lang-opt]').forEach((opt) =>
      opt.classList.toggle('is-active', opt.dataset.langOpt === lang));

    reveal();
  }

  function showSheetSize() {
    document.getElementById('footer-coords').textContent = `${innerWidth} × ${innerHeight} px`;
  }

  document.getElementById('lang-toggle').addEventListener('click', () => {
    lang = lang === 'pt' ? 'en' : 'pt';
    saveLang();
    if (cv) render();
  });

  // O cartão de um item abre acima ou abaixo da coluna; se não couber na janela, abre ao lado
  function fitPopover(event) {
    const item = event.target.closest?.('.tl__item.has-pop');
    if (!item || item.contains(event.relatedTarget)) return;
    item.classList.remove('is-side');
    const box = item.querySelector('.tl__pop').getBoundingClientRect();
    const topbar = document.querySelector('.topbar').getBoundingClientRect().bottom;
    if (box.bottom > innerHeight - 8 || box.top < topbar + 4) item.classList.add('is-side');
  }
  document.getElementById('timeline').addEventListener('mouseover', fitPopover);
  document.getElementById('timeline').addEventListener('focusin', fitPopover);

  window.addEventListener('resize', showSheetSize);
  showSheetSize();

  fetch('data/cv.json', { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      cv = data;
      render();
      // reaplica a âncora da URL depois que as seções existem
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    })
    .catch((err) => {
      console.error('Falha ao carregar data/cv.json:', err);
      document.getElementById('sections').replaceChildren(
        el('p', { class: 'status' }, 'Não foi possível carregar o conteúdo. / Could not load content.'));
    });
})();
