/* ============================================================
   home.js: the landing page's live pieces
   The hero equation is computed on the page from the real
   factorization code, so the site can never show an example
   that its own algorithm disagrees with.
   ============================================================ */
(function () {
  'use strict';

  const S = window.Site, R = window.Render, E = window.ExampleData, LDU = window.LDU;
  const h = S.h, icon = S.icon, ICONS = S.ICONS;

  /* ---------- hero equation ---------- */
  function buildDemo() {
    const host = document.getElementById('demo-equation');
    if (!host) return;

    const ex = E.byId('classic-3x3');
    const A = E.toMatrix(ex);
    const res = LDU.factorize(A, { recordSteps: false });

    host.appendChild(R.equation([
      { name: 'A', matrix: res.A },
      { op: '=' },
      { name: 'L', matrix: res.L, opts: { unit: true } },
      { op: '·' },
      { name: 'D', matrix: res.D, opts: { diag: true } },
      { op: '·' },
      { name: 'U', matrix: res.U, opts: { unit: true } }
    ]));

    const note = document.getElementById('demo-note');
    if (note) {
      note.textContent =
        'L holds the multipliers used during elimination, D holds the pivots (2, −8 and 1, whose product ' +
        'is the determinant, −16), and U is what is left once each row is scaled to start with a 1. ' +
        'The three factors multiply back to A exactly.';
    }

    const v = document.getElementById('demo-verified');
    if (v && !res.verification.matches) {
      v.className = 'badge badge-err badge-dot';
      v.textContent = 'verification failed';
    }

    const ico = document.getElementById('demo-ico');
    if (ico) ico.appendChild(icon(ICONS.layers));
  }

  /* ---------- learning path ---------- */
  const PATH = [
    { page: 'theory.html', title: 'Theory', text: 'What L, D and U are; the existence and uniqueness theorem; how LDU relates to LU, PLU and Cholesky.' },
    { page: 'algorithm.html', title: 'The Algorithm', text: 'Derive the method from Gaussian elimination, handle pivots honestly, and read the pseudocode.' },
    { page: 'calculator.html', title: 'Calculator', text: 'Factor any matrix exactly. Every stage, every multiplier, every verification shown.' },
    { page: 'examples.html', title: 'Worked Examples', text: 'Clean cases, fractional cases, permutations, singular matrices and the one that has no factorization.' },
    { page: 'applications.html', title: 'Applications', text: 'Solve Ax = b by substitution, read off determinants, invert matrices, and reach Cholesky.' },
    { page: 'practice.html', title: 'Practice', text: 'Questions generated from real matrices, with the reasoning revealed after each answer.' }
  ];

  function buildPath() {
    const host = document.getElementById('path-host');
    if (!host) return;
    PATH.forEach((p, i) => {
      host.appendChild(h('a', { class: 'path-item', href: p.page }, [
        h('span', { class: 'path-num' }, String(i + 1)),
        h('div', {}, [h('h3', {}, p.title), h('p', {}, p.text)]),
        h('span', { class: 'path-arrow' }, icon(ICONS.arrowRight))
      ]));
    });
  }

  /* ---------- feature cards ---------- */
  const FEATURES = [
    { ico: 'sigma', title: 'Exact rational arithmetic', text: 'Every value is a ratio of arbitrary-precision integers. Nothing is ever rounded, so nothing is ever quietly wrong.' },
    { ico: 'layers', title: 'Step-by-step, in two phases', text: 'Watch elimination build L and Û, then watch Û split into D and U. Each multiplier is shown with its arithmetic.' },
    { ico: 'check', title: 'Every result is verified', text: 'The product L·D·U is recomputed and compared to A entry by entry. If it ever disagreed, you would be told.' },
    { ico: 'alert', title: 'Honest about failure', text: 'When a matrix has no LDU factorization, you get an explanation of why: not a grid full of NaN.' },
    { ico: 'target', title: 'Full diagnostics', text: 'Determinant, rank, leading principal minors, symmetry, definiteness and the permutation, all computed exactly.' },
    { ico: 'zap', title: 'No dependencies', text: 'Plain HTML, CSS and JavaScript. Works offline straight from the file system, on any modern browser.' }
  ];

  function buildFeatures() {
    const host = document.getElementById('features-host');
    if (!host) return;
    FEATURES.forEach(f => {
      host.appendChild(h('div', { class: 'card feature card-hover' }, [
        h('span', { class: 'feature-ico' }, icon(ICONS[f.ico])),
        h('h3', {}, f.title),
        h('p', {}, f.text)
      ]));
    });
  }

  function buildSmallIcons() {
    const pairs = [['exact-ico', 'sigma'], ['cases-ico', 'compass']];
    pairs.forEach(([id, name]) => {
      const el = document.getElementById(id);
      if (el) el.appendChild(icon(ICONS[name]));
    });
  }

  function start() {
    buildDemo();
    buildPath();
    buildFeatures();
    buildSmallIcons();
    S.revealOnScroll('[data-reveal]');
  }

  S.ready(start);
})();
