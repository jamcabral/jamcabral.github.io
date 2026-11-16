/*
 * Renderiza o currículo a partir de data/cv.json e alterna PT/EN.
 * Todo o conteúdo vive no JSON; este arquivo só sabe montar as seções.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'lang';
  const showDrafts = new URLSearchParams(location.search).has('draft');

  let cv = null;
  let lang = initialLang();

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

  const label = (n, key) =>
    el('h2', { class: 'label' }, `[ ${String(n).padStart(2, '0')} / ${t(cv.ui.sections[key])} ]`);

  /* ---------------------------------------------------------------- seções */

  function renderAbout(about) {
    const currently = visible(about.currently);
    return el('div', { class: 'about' },
      visible(about.paragraphs).map((p) => el('p', null, t(p))),
      currently.length
        ? el('div', { class: 'about__currently' },
            el('h3', null, `// ${t(cv.ui.currently)}`),
            el('ul', null, currently.map((item) => el('li', null, t(item)))))
        : null);
  }

  function renderExperience(items) {
    return el('div', null, items.map((job) =>
      el('article', { class: `entry${job.draft ? ' draft' : ''}` },
        date(t(job.period)),
        el('div', null,
          el('h3', { class: 'entry__title' }, t(job.role)),
          el('p', { class: 'entry__org' }, t(job.org)),
          job.description ? el('p', { class: 'entry__desc' }, t(job.description)) : null,
          chips(job.stack)))));
  }

  function renderEducation(items) {
    return el('div', null, items.map((edu) =>
      el('article', { class: `entry${edu.draft ? ' draft' : ''}` },
        date(t(edu.period)),
        el('div', null,
          el('h3', { class: 'entry__title' }, t(edu.degree)),
          el('p', { class: 'entry__org' }, t(edu.institution)),
          edu.note ? el('p', { class: 'entry__desc' }, t(edu.note)) : null,
          chips(null, edu.status)))));
  }

  function renderProjects(items) {
    const sorted = [...items].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    return el('div', { class: 'projects' }, sorted.map((project) => {
      const href = project.link || project.repo;
      return el('article', { class: `card${project.featured ? ' card--featured' : ''}${project.draft ? ' draft' : ''}` },
        el('div', { class: 'card__head' },
          el('h3', { class: 'card__name' }, t(project.name)),
          href
            ? el('a', { class: 'card__link', href, target: '_blank', rel: 'noopener noreferrer' },
                `${project.link ? t(cv.ui.open) : t(cv.ui.repo)} ↗`)
            : null),
        el('p', { class: 'card__desc' }, t(project.description)),
        chips(project.stack, project.featured && cv.ui.featured));
    }));
  }

  // Publicações, palestras e certificações: { date, title, venue, description, link, stack }
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

  function renderSkills(groups) {
    return el('div', { class: 'skills' }, groups.map((group) =>
      el('div', { class: 'skills__group' },
        el('h3', { class: 'skills__label' }, t(group.label)),
        chips(group.items))));
  }

  /* ---------------------------------------------------------------- página */

  function renderHero() {
    const { profile } = cv;
    document.getElementById('hero-label').textContent = `[ 00 / ${t(cv.ui.sections.profile)} ]`;
    document.getElementById('hero-name').textContent = profile.name;
    document.getElementById('hero-title').textContent = t(profile.title);
    document.getElementById('hero-summary').textContent = t(profile.summary);
    document.getElementById('hero-links').replaceChildren(
      ...profile.links.map((link) => el('li', null, external(link.url, `${t(link.label)} ↗`))),
      ...(profile.location ? [el('li', null, el('span', null, t(profile.location)))] : []));
  }

  function render() {
    const sections = [
      { key: 'about', show: cv.about && (visible(cv.about.paragraphs).length || visible(cv.about.currently).length), build: () => renderAbout(cv.about) },
      { key: 'experience', items: visible(cv.experience), build: renderExperience },
      { key: 'education', items: visible(cv.education), build: renderEducation },
      { key: 'projects', items: visible(cv.projects), build: renderProjects },
      { key: 'publications', items: visible(cv.publications), build: renderListing },
      { key: 'certifications', items: visible(cv.certifications), build: renderListing },
      { key: 'skills', items: visible(cv.skills), build: renderSkills },
    ].filter((s) => (s.items ? s.items.length > 0 : s.show));

    renderHero();

    document.getElementById('sections').replaceChildren(...sections.map((s, i) =>
      el('section', { class: 'section', id: s.key }, label(i + 1, s.key), s.build(s.items))));

    document.getElementById('nav').replaceChildren(...sections.map((s) =>
      el('a', { href: `#${s.key}` }, t(cv.ui.nav?.[s.key] ?? cv.ui.sections[s.key]))));

    document.getElementById('footer-copy').textContent =
      `© ${new Date().getFullYear()} ${cv.profile.name} — ${t(cv.ui.footer)}`;

    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = t(cv.ui.pageTitle);

    const toggle = document.getElementById('lang-toggle');
    toggle.setAttribute('aria-label', t(cv.ui.switchTo));
    toggle.querySelectorAll('[data-lang-opt]').forEach((opt) =>
      opt.classList.toggle('is-active', opt.dataset.langOpt === lang));
  }

  function showSheetSize() {
    document.getElementById('footer-coords').textContent = `${innerWidth} × ${innerHeight} px`;
  }

  document.getElementById('lang-toggle').addEventListener('click', () => {
    lang = lang === 'pt' ? 'en' : 'pt';
    saveLang();
    if (cv) render();
  });

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
