/* ============================================================
   site.js, shared chrome for every page
   Navigation, footer, theme, toasts, table of contents.
   Loaded on all pages; each page only needs <div id="nav-host">
   and <div id="footer-host">.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- the site map: one source of truth ---------- */
  const PAGES = [
    { id: 'home',         href: 'index.html',        nav: 'Home',         title: 'DecomposeX',              blurb: 'Start here' },
    { id: 'theory',       href: 'theory.html',       nav: 'Theory',       title: 'Theory',                  blurb: 'What L, D and U are, and when they exist' },
    { id: 'algorithm',    href: 'algorithm.html',    nav: 'Algorithm',    title: 'The Algorithm',           blurb: 'Deriving the method from Gaussian elimination' },
    { id: 'calculator',   href: 'calculator.html',   nav: 'Calculator',   title: 'Calculator',              blurb: 'Factor any matrix, exactly, step by step' },
    { id: 'examples',     href: 'examples.html',     nav: 'Examples',     title: 'Worked Examples',         blurb: 'Every case, solved and explained' },
    { id: 'applications', href: 'applications.html', nav: 'Applications', title: 'Applications',            blurb: 'Solving systems, determinants, inverses' },
    { id: 'practice',     href: 'practice.html',     nav: 'Practice',     title: 'Practice',                blurb: 'Test yourself' },
    { id: 'about',        href: 'about.html',        nav: 'About',        title: 'About',                   blurb: 'The project and further reading' }
  ];

  const REPO = 'https://github.com/iPriyadarshi/DecomposeX';

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children != null) append(el, children);
    return el;
  }

  function append(el, children) {
    if (Array.isArray(children)) children.forEach(c => append(el, c));
    else if (children instanceof Node) el.appendChild(children);
    else if (children !== null && children !== undefined && children !== false) el.appendChild(document.createTextNode(String(children)));
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  /**
   * Inline SVG icon. Everything is drawn on a 24x24 grid with a 1.8px
   * stroke and round caps, so the whole set shares one optical weight.
   *
   * A shape is either a path string, or one of:
   *   { circle: [cx, cy, r] }         stroked circle
   *   { dot:    [cx, cy, r?] }        filled dot, default r = 1.15
   *   { line:   [x1, y1, x2, y2] }    straight segment
   *   { rect:   [x, y, w, h, r?] }    rounded rectangle, default r = 2
   *   { fill:   'M...' }              filled path, no stroke
   *
   * Real circles and rects matter: the previous set faked dots with
   * zero-length paths, which only rendered because the stroke cap
   * happened to be round.
   */
  function icon(shapes, opts) {
    const o = opts || {};
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', o.stroke || 'currentColor');
    svg.setAttribute('stroke-width', o.width || '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    const make = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      svg.appendChild(el);
      return el;
    };

    (Array.isArray(shapes) ? shapes : [shapes]).forEach(sh => {
      if (typeof sh === 'string') { make('path', { d: sh }); return; }
      if (sh.circle) { make('circle', { cx: sh.circle[0], cy: sh.circle[1], r: sh.circle[2] }); return; }
      if (sh.dot) {
        make('circle', {
          cx : sh.dot[0], cy : sh.dot[1], r : sh.dot[2] == null ? 1.15 : sh.dot[2],
          fill: 'currentColor', stroke: 'none'
        });
        return;
      }
      if (sh.fill) { make('path', { d: sh.fill, fill: 'currentColor', stroke: 'none' }); return; }
      if (sh.line) { make('line', { x1: sh.line[0], y1: sh.line[1], x2: sh.line[2], y2: sh.line[3] }); return; }
      if (sh.rect) {
        make('rect', {
          x: sh.rect[0], y: sh.rect[1], width: sh.rect[2], height: sh.rect[3],
          rx : sh.rect[4] == null ? 2 : sh.rect[4]
        });
      }
    });

    return svg;
  }

  /* ---------- icon library ----------
     Drawn for this site rather than borrowed: the mark, the matrix and
     the sigma each say something about what the page does.             */
  const ICONS = {
    /* The mark: a matrix split along its diagonal, which is the whole
       subject of the site in three strokes. */
    brand: [
      'M9.5 4.5H5.5v15h4',
      'M14.5 4.5h4v15h-4',
      { line: [9.2, 15.4, 14.8, 8.6] }
    ],

    /* A bracketed 2x2 of entries. */
    matrix: [
      'M8 5H5v14h3',
      'M16 5h3v14h-3',
      { dot: [10.2, 9.4] }, { dot: [13.8, 9.4] },
      { dot: [10.2, 14.6] }, { dot: [13.8, 14.6] }
    ],

    /* Sigma, for exact summation. */
    sigma: ['M17 5H7l6 7-6 7h10'],

    /* Three stacked plates, for the phases of the algorithm. */
    layers: [
      'M12 3.5l8.5 4.5-8.5 4.5L3.5 8z',
      'M3.5 12.4l8.5 4.5 8.5-4.5',
      'M3.5 16.4l8.5 4.5 8.5-4.5'
    ],

    calc: [
      { rect: [5, 3, 14, 18, 2.5] },
      { rect: [8, 6, 8, 3, 1] },
      { dot: [9.5, 12.5] }, { dot: [12, 12.5] }, { dot: [14.5, 12.5] },
      { dot: [9.5, 16] }, { dot: [12, 16] }, { dot: [14.5, 16] },
      { line: [9.5, 18.8, 14.5, 18.8] }
    ],

    /* An open book, for the theory. */
    book: [
      'M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5z',
      'M20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5A1.5 1.5 0 0020 18.5z'
    ],

    check: ['M4.5 12.4l5 5 10-10'],

    alert: [
      'M12 4.2L21 19.8H3z',
      { line: [12, 9.8, 12, 14.2] },
      { dot: [12, 17] }
    ],

    info: [
      { circle: [12, 12, 8.5] },
      { line: [12, 11.2, 12, 16.4] },
      { dot: [12, 8.2] }
    ],

    x: [
      { circle: [12, 12, 8.5] },
      { line: [9.3, 9.3, 14.7, 14.7] },
      { line: [14.7, 9.3, 9.3, 14.7] }
    ],

    close: [
      { line: [6.5, 6.5, 17.5, 17.5] },
      { line: [17.5, 6.5, 6.5, 17.5] }
    ],

    menu: [
      { line: [4, 7.5, 20, 7.5] },
      { line: [4, 12, 20, 12] },
      { line: [4, 16.5, 20, 16.5] }
    ],

    copy: [
      { rect: [9, 9, 11, 11, 2] },
      'M15 9V5.5A1.5 1.5 0 0013.5 4h-8A1.5 1.5 0 004 5.5v8A1.5 1.5 0 005.5 15H9'
    ],

    arrowRight: ['M4.5 12h14', 'M13.2 6.6L18.8 12l-5.6 5.4'],

    github: [{ fill: 'M12 0.297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 0.405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 0.315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' }],

    /* Concentric rings with a centre, for a solved target. */
    target: [
      { circle: [12, 12, 8.5] },
      { circle: [12, 12, 4.2] },
      { dot: [12, 12, 1.3] }
    ],

    /* A compass needle, for orientation. */
    compass: [
      { circle: [12, 12, 8.5] },
      'M15.6 8.4l-2.4 6.8-6.8 2.4 2.4-6.8z'
    ],

    lightbulb: [
      { circle: [12, 9.6, 5] },
      'M9.7 14.1c0.3 0.7 0.5 1.4 0.5 2.2h3.6c0-0.8 0.2-1.5 0.5-2.2',
      { line: [9.9, 18.3, 14.1, 18.3] },
      { line: [10.9, 20.8, 13.1, 20.8] }
    ],

    eye: [
      'M2.5 12S6.2 6.5 12 6.5 21.5 12 21.5 12 17.8 17.5 12 17.5 2.5 12 2.5 12z',
      { circle: [12, 12, 2.9] }
    ],

    /* Two arcs, so it reads as a cycle at any size. */
    refresh: [
      'M3.8 12a8.2 8.2 0 0114.1-5.7',
      'M20.2 12a8.2 8.2 0 01-14.1 5.7',
      'M18 3.2v3.6h-3.6',
      'M6 20.8v-3.6h3.6'
    ],

    dice: [
      { rect: [4, 4, 16, 16, 3] },
      { dot: [8.6, 8.6] }, { dot: [15.4, 8.6] },
      { dot: [12, 12] },
      { dot: [8.6, 15.4] }, { dot: [15.4, 15.4] }
    ],

    download: [
      { line: [12, 4, 12, 14.8] },
      'M7.6 10.6L12 15l4.4-4.4',
      { line: [4.5, 19.5, 19.5, 19.5] }
    ],

    zap: ['M13.2 3L5 13.6h5.3L10.8 21 19 10.4h-5.3z'],

    sun: [
      { circle: [12, 12, 4] },
      { line: [12, 2.6, 12, 4.6] }, { line: [12, 19.4, 12, 21.4] },
      { line: [2.6, 12, 4.6, 12] }, { line: [19.4, 12, 21.4, 12] },
      { line: [5.6, 5.6, 7, 7] }, { line: [17, 17, 18.4, 18.4] },
      { line: [17, 7, 18.4, 5.6] }, { line: [5.6, 18.4, 7, 17] }
    ],

    moon: ['M20.5 15A9 9 0 019 3.5 9 9 0 1020.5 15z']
  };

  /* ---------- theme ---------- */
  const THEME_KEY = 'decomposex:theme';

  function prefersDark() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme')
      || (prefersDark() ? 'dark' : 'light');
  }

  function setTheme(t, persist) {
    document.documentElement.setAttribute('data-theme', t);
    if (persist !== false) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
    document.dispatchEvent(new CustomEvent('decomposex:themechange', { detail: { theme: t } }));
  }

  function toggleTheme() {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  /**
   * Resolves the theme to an explicit data-theme attribute: the stored
   * choice if there is one, otherwise the operating-system preference.
   * Making it explicit means the stylesheet needs only one dark block
   * rather than a duplicate inside a prefers-color-scheme query.
   *
   * The same few lines run inline in each page's <head> so the right
   * palette is painted on the first frame instead of flashing light.
   */
  function initTheme() {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
    const resolved = (stored === 'dark' || stored === 'light') ? stored : (prefersDark() ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', resolved);
  }

  /* ---------- chrome injection ---------- */
  function currentPageId() {
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const found = PAGES.find(p => p.href.toLowerCase() === file);
    if (found) return found.id;
    return document.body.dataset.page || 'home';
  }

  function buildNav(activeId) {
    const links = h('div', { class: 'nav-links', id: 'nav-links' },
      PAGES.filter(p => p.id !== 'about').map(p =>
        h('a', {
          href: p.href,
          'aria-current' : p.id === activeId ? 'page' : null
        }, p.nav)
      )
    );

    const toggle = h('button', {
      class: 'icon-btn nav-toggle',
      type: 'button',
      'aria-label': 'Toggle navigation menu',
      'aria-expanded': 'false',
      'aria-controls': 'nav-links'
    }, icon(ICONS.menu));

    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      clear(toggle).appendChild(icon(open ? ICONS.close : ICONS.menu));
    });

    /* One icon at a time: the sun and moon are both in the DOM and CSS
       shows whichever matches the current theme. They must not carry an
       inline `display`, because that would outrank the stylesheet's
       `display:none` and render both at once. */
    const sunIcon = icon(ICONS.sun);
    sunIcon.classList.add('theme-sun');
    const moonIcon = icon(ICONS.moon);
    moonIcon.classList.add('theme-moon');

    const themeBtn = h('button', { class: 'icon-btn', type: 'button' }, [sunIcon, moonIcon]);

    const labelTheme = () => {
      const goingDark = currentTheme() !== 'dark';
      const text = goingDark ? 'Switch to dark theme' : 'Switch to light theme';
      themeBtn.setAttribute('aria-label', text);
      themeBtn.setAttribute('title', text);
    };
    labelTheme();

    themeBtn.addEventListener('click', () => { toggleTheme(); labelTheme(); });
    document.addEventListener('decomposex:themechange', labelTheme);

    const nav = h('nav', { class: 'nav', 'aria-label': 'Main' },
      h('div', { class: 'wrap nav-inner' }, [
        h('a', { class: 'brand', href: 'index.html', 'aria-label': 'DecomposeX home' }, [
          h('span', { class: 'brand-mark' }, icon(ICONS.brand)),
          h('span', {}, [ 'Decompose', h('span', { class: 'brand-x' }, 'X') ])
        ]),
        links,
        h('div', { class: 'nav-actions' }, [
          themeBtn,
          h('a', {
            class: 'icon-btn', href: REPO, target: '_blank', rel: 'noopener',
            'aria-label': 'View the source on GitHub', title: 'Source on GitHub'
          }, icon(ICONS.github)),
          h('a', { class: 'btn btn-sm', href: 'calculator.html' }, [
            icon(ICONS.calc),
            h('span', { class: 'nav-cta-text' }, 'Calculator')
          ])
        ])
      ])
    );

    // Close the mobile menu after following a link or pressing Escape.
    links.addEventListener('click', e => {
      if (e.target.closest('a')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        clear(toggle).appendChild(icon(ICONS.menu));
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        clear(toggle).appendChild(icon(ICONS.menu));
        toggle.focus();
      }
    });

    return nav;
  }

  function buildFooter() {
    const learn = PAGES.slice(1, 4);
    const doIt = PAGES.slice(4, 7);

    return h('footer', { class: 'footer' },
      h('div', { class: 'wrap' }, [
        h('div', { class: 'footer-grid' }, [
          h('div', {}, [
            h('a', { class: 'brand', href: 'index.html', style: 'margin-bottom:12px' }, [
              h('span', { class: 'brand-mark' }, icon(ICONS.brand)),
              h('span', {}, ['Decompose', h('span', { class: 'brand-x' }, 'X')])
            ]),
            h('p', { class: 'text-sm', style: 'max-width:34ch' },
              'A complete, exact and open guide to LDU factorization, from the theorem to the arithmetic.')
          ]),
          h('div', {}, [
            h('h4', {}, 'Learn'),
            h('ul', {}, learn.map(p => h('li', {}, h('a', { href: p.href }, p.title))))
          ]),
          h('div', {}, [
            h('h4', {}, 'Use'),
            h('ul', {}, doIt.map(p => h('li', {}, h('a', { href: p.href }, p.title))))
          ]),
          h('div', {}, [
            h('h4', {}, 'Project'),
            h('ul', {}, [
              h('li', {}, h('a', { href: 'about.html' }, 'About')),
              h('li', {}, h('a', { href: REPO, target: '_blank', rel: 'noopener' }, 'Source code')),
              h('li', {}, h('a', { href: REPO + '/issues', target: '_blank', rel: 'noopener' }, 'Report an issue'))
            ])
          ])
        ])
      ])
    );
  }

  /** Previous / next links following the learning order. */
  function buildPageNav(activeId) {
    const i = PAGES.findIndex(p => p.id === activeId);
    if (i === -1) return null;
    const prev = PAGES[i - 1], next = PAGES[i + 1];
    if (!prev && !next) return null;

    const nav = h('nav', { class: 'pagenav', 'aria-label': 'Page navigation' });
    if (prev) nav.appendChild(h('a', { href: prev.href, class: 'prev' }, [
      h('span', { class: 'dir' }, '← Previous'),
      h('span', { class: 'ttl' }, prev.title),
      h('span', { class: 'text-xs text-mute' }, prev.blurb)
    ]));
    if (next) nav.appendChild(h('a', { href: next.href, class: 'next' }, [
      h('span', { class: 'dir' }, 'Next →'),
      h('span', { class: 'ttl' }, next.title),
      h('span', { class: 'text-xs text-mute' }, next.blurb)
    ]));
    return nav;
  }

  /* ---------- toasts ---------- */
  let toastHost = null;
  function toast(message, ms) {
    if (!toastHost) {
      toastHost = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastHost);
    }
    const t = h('div', { class: 'toast' }, message);
    toastHost.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 220);
    }, ms || 2200);
  }

  /* ---------- clipboard ---------- */
  function copyText(text, label) {
    const done = () => toast((label || 'Copied') + ' to clipboard');
    const fallback = () => {
      // navigator.clipboard is unavailable on file:// in some browsers.
      const ta = h('textarea', {
        style: 'position:fixed;top:-1000px;left:-1000px;opacity:0'
      });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) done();
      else toast('Copy failed, select the text and press Ctrl+C');
    };

    if (navigator.clipboard && navigator.clipboard.writeText && location.protocol !== 'file:') {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  /** A small "copy" button wired to a text-producing function. */
  function copyButton(getText, label, opts) {
    const o = opts || {};
    const b = h('button', {
      class: 'btn btn-ghost btn-sm', type: 'button',
      title: 'Copy ' + (label || 'to clipboard')
    }, [icon(ICONS.copy), o.hideLabel ? null : (label || 'Copy')]);
    b.addEventListener('click', () => copyText(getText(), label));
    return b;
  }

  /* ---------- download ---------- */
  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 100);
  }

  /* ---------- table of contents ---------- */
  /**
   * Builds a TOC from the h2/h3 headings inside `scopeSelector`
   * and highlights the heading currently in view.
   */
  function buildToc(scopeSelector, hostSelector) {
    const scope = document.querySelector(scopeSelector);
    const host = document.querySelector(hostSelector);
    if (!scope || !host) return;

    const heads = Array.from(scope.querySelectorAll('h2[id], h3[id]'));
    if (!heads.length) return;

    clear(host);
    host.appendChild(h('span', { class: 'toc-title' }, 'On this page'));
    const links = heads.map(hd => {
      const a = h('a', { href : '#' + hd.id, class : hd.tagName === 'H3' ? 'sub' : null }, hd.textContent.trim());
      host.appendChild(a);
      return a;
    });

    if (!('IntersectionObserver' in window)) return;

    const seen = new Map();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(e.target, e));
      // Highlight the topmost heading that is at or above the viewport top.
      let activeIdx = 0;
      heads.forEach((hd, i) => {
        const r = hd.getBoundingClientRect();
        if (r.top <= 120) activeIdx = i;
      });
      links.forEach((a, i) => a.classList.toggle('active', i === activeIdx));
    }, { rootMargin: '-100px 0px -70% 0px', threshold: [0, 1] });

    heads.forEach(hd => io.observe(hd));
  }

  /* ---------- reveal on scroll ---------- */
  function revealOnScroll(selector) {
    const els = Array.from(document.querySelectorAll(selector));
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(e => e.classList.add('anim-in'));
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('anim-in'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  }

  /* ---------- boot ---------- */
  /**
   * Runs `fn` once the DOM is ready, and never more than once.
   * Several page scripts render by appending, so a second call would
   * duplicate their output: the guard makes that impossible.
   */
  function ready(fn) {
    let done = false;
    const run = () => { if (done) return; done = true; fn(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  function mount() {
    initTheme();

    const activeId = currentPageId();
    document.documentElement.dataset.activePage = activeId;

    const navHost = document.getElementById('nav-host');
    if (navHost) { clear(navHost); navHost.appendChild(buildNav(activeId)); }

    const footHost = document.getElementById('footer-host');
    if (footHost) { clear(footHost); footHost.appendChild(buildFooter()); }

    const pnHost = document.getElementById('pagenav-host');
    if (pnHost) {
      const pn = buildPageNav(activeId);
      if (pn) { clear(pnHost); pnHost.appendChild(pn); }
    }

    // Reflect OS theme changes when the user has not chosen explicitly.
    try {
      if (!localStorage.getItem(THEME_KEY) && matchMedia) {
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
          setTheme(e.matches ? 'dark' : 'light', false);
        });
      }
    } catch (e) {}

    revealOnScroll('[data-reveal]');
  }

  ready(mount);

  global.Site = {
    PAGES, REPO, ICONS,
    h, append, clear, icon,
    ready,
    setTheme, toggleTheme, currentTheme, initTheme,
    toast, copyText, copyButton, downloadText,
    buildToc, revealOnScroll, buildPageNav
  };
})(typeof window !== 'undefined' ? window : globalThis);
