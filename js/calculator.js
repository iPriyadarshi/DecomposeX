/* ============================================================
   calculator.js: the interactive factorizer
   ============================================================ */
(function () {
  'use strict';

  const F = window.Fraction, M = window.Mat, LDU = window.LDU;
  const S = window.Site, R = window.Render, E = window.ExampleData;
  const h = S.h, icon = S.icon, ICONS = S.ICONS, clear = S.clear;
  const sub = R.sub;

  const STORE_KEY = 'decomposex:calc';
  const MIN_N = 1, MAX_N = 10;

  /* ---------------- state ---------------- */
  const state = {
    n: 3,
    cells: [],          // string[][] exactly as typed
    b: [],              // string[]
    mode: 'fraction',
    places: 4,
    pivot: LDU.PIVOT.WHEN_ZERO,
    solve: false,
    tab: 'factors',
    result: null,
    solution: null,
    exampleId: ''
  };

  const els = {};
  function $(id) { return document.getElementById(id); }

  /* ---------------- helpers ---------------- */
  function fmtOpts() { return { mode: state.mode, places: state.places }; }

  function blankCells(n, old) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push([]);
      for (let j = 0; j < n; j++) {
        out[i].push(old && old[i] && old[i][j] !== undefined ? old[i][j] : '0');
      }
    }
    return out;
  }

  function matrixToCells(A) {
    return A.map(row => row.map(v => v.toFractionString()));
  }

  /* ---------------- persistence ---------------- */
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        n: state.n, cells: state.cells, b: state.b,
        mode: state.mode, places: state.places,
        pivot: state.pivot, solve: state.solve, tab: state.tab
      }));
    } catch (e) { /* storage may be unavailable; not important */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.cells)) return false;
      state.n = clampN(d.n || 3);
      state.cells = blankCells(state.n, d.cells);
      state.b = Array.from({ length: state.n }, (_, i) => (d.b && d.b[i]) || '0');
      if (d.mode === 'decimal' || d.mode === 'fraction') state.mode = d.mode;
      if (d.places >= 1 && d.places <= 12) state.places = d.places;
      if (Object.values(LDU.PIVOT).indexOf(d.pivot) !== -1) state.pivot = d.pivot;
      state.solve = !!d.solve;
      if (d.tab) state.tab = d.tab;
      return true;
    } catch (e) { return false; }
  }

  function clampN(n) {
    n = parseInt(n, 10);
    if (!Number.isFinite(n)) return 3;
    return Math.min(MAX_N, Math.max(MIN_N, n));
  }

  /* ---------------- URL sharing ---------------- */
  /** "#m=2,1,1;4,-6,0;-2,7,2", compact and readable. */
  function encodeHash() {
    const m = state.cells.map(r => r.map(c => (c === '' ? '0' : c)).join(',')).join(';');
    let s = 'm=' + encodeURIComponent(m);
    if (state.solve) s += '&b=' + encodeURIComponent(state.b.join(','));
    if (state.mode !== 'fraction') s += '&f=d';
    if (state.pivot !== LDU.PIVOT.WHEN_ZERO) s += '&p=' + state.pivot;
    return '#' + s;
  }

  function applyHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return false;
    const params = {};
    raw.split('&').forEach(pair => {
      const i = pair.indexOf('=');
      if (i > 0) params[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
    });

    // ?example=id style, also accepted in the hash
    if (params.example) {
      const ex = E.byId(params.example);
      if (ex) { loadExample(ex, false); return true; }
    }

    if (!params.m) return false;
    const parsed = M.parseText(params.m.replace(/;/g, '\n'));
    if (!parsed.ok) return false;

    state.n = clampN(parsed.n);
    state.cells = matrixToCells(parsed.matrix);
    state.b = Array.from({ length: state.n }, () => '0');

    if (params.b) {
      params.b.split(',').forEach((v, i) => { if (i < state.n) state.b[i] = v.trim() || '0'; });
      state.solve = true;
    }
    if (params.f === 'd') state.mode = 'decimal';
    if (params.p && Object.values(LDU.PIVOT).indexOf(params.p) !== -1) state.pivot = params.p;
    return true;
  }

  /* ---------------- input grid ---------------- */
  function buildGrid() {
    const host = els.gridHost;
    clear(host);
    const n = state.n;

    const body = h('div', {
      class: 'mx-input-body',
      style: `grid-template-columns: repeat(${n}, minmax(52px, 1fr)); min-width:${n * 58}px`
    });

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const input = h('input', {
          class : 'mx-in' + (i === j ? ' on-diag' : ''),
          type: 'text',
          inputmode: 'text',
          spellcheck: 'false',
          autocomplete: 'off',
          value: state.cells[i][j],
          'data-i': i,
          'data-j': j,
          'aria-label': `Row ${i + 1}, column ${j + 1}`
        });
        body.appendChild(input);
      }
    }

    const grid = h('div', { class: 'mx' }, [
      h('span', { class: 'mx-bracket mx-bracket-l', 'aria-hidden': 'true' }),
      body,
      h('span', { class: 'mx-bracket mx-bracket-r', 'aria-hidden': 'true' })
    ]);

    host.appendChild(grid);

    body.addEventListener('input', onCellInput);
    body.addEventListener('keydown', onCellKey);
    body.addEventListener('paste', onCellPaste);
    body.addEventListener('focusin', e => {
      if (e.target.classList.contains('mx-in')) e.target.select();
    });
  }

  function buildBGrid() {
    const host = els.bHost;
    clear(host);
    const n = state.n;
    const body = h('div', { class: 'mx-input-body', style: 'grid-template-columns: minmax(52px, 80px)' });
    for (let i = 0; i < n; i++) {
      body.appendChild(h('input', {
        class: 'mx-in', type: 'text', spellcheck: 'false', autocomplete: 'off',
        value: state.b[i], 'data-bi': i, 'aria-label': `b entry ${i + 1}`
      }));
    }
    const grid = h('div', { class: 'mx' }, [
      h('span', { class: 'mx-bracket mx-bracket-l', 'aria-hidden': 'true' }),
      body,
      h('span', { class: 'mx-bracket mx-bracket-r', 'aria-hidden': 'true' })
    ]);
    host.appendChild(grid);

    body.addEventListener('input', e => {
      const i = +e.target.dataset.bi;
      state.b[i] = e.target.value;
      validateOne(e.target, e.target.value);
      scheduleCompute();
    });
    body.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); compute(); } });
  }

  function onCellInput(e) {
    const t = e.target;
    if (!t.classList.contains('mx-in')) return;
    const i = +t.dataset.i, j = +t.dataset.j;
    state.cells[i][j] = t.value;
    state.exampleId = '';
    els.exampleSelect.value = '';
    els.exampleNote.textContent = '';
    validateOne(t, t.value);
    scheduleCompute();
  }

  function validateOne(input, value) {
    const v = String(value).trim();
    const bad = v !== '' && F.parse(v) === null;
    input.classList.toggle('invalid', bad);
    return !bad;
  }

  function onCellKey(e) {
    const t = e.target;
    if (!t.classList.contains('mx-in')) return;
    const i = +t.dataset.i, j = +t.dataset.j, n = state.n;

    if (e.key === 'Enter') { e.preventDefault(); compute(); return; }

    let ni = i, nj = j;
    if (e.key === 'ArrowUp') ni = i - 1;
    else if (e.key === 'ArrowDown') ni = i + 1;
    else if (e.key === 'ArrowLeft' && (t.selectionStart === 0 || t.value === '')) nj = j - 1;
    else if (e.key === 'ArrowRight' && (t.selectionStart === t.value.length || t.value === '')) nj = j + 1;
    else return;

    if (ni < 0 || ni >= n || nj < 0 || nj >= n) return;
    e.preventDefault();
    focusCell(ni, nj);
  }

  function focusCell(i, j) {
    const el = els.gridHost.querySelector(`.mx-in[data-i="${i}"][data-j="${j}"]`);
    if (el) { el.focus(); el.select(); }
  }

  /** Pasting a block of numbers into a cell fills the grid from that cell. */
  function onCellPaste(e) {
    const t = e.target;
    if (!t.classList.contains('mx-in')) return;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text || !/[\s;]/.test(text.trim())) return;   // a single value pastes normally

    e.preventDefault();
    const rows = text.trim().split(/[;\n\r]+/).map(l => l.trim()).filter(Boolean)
.map(l => l.replace(/[\[\]\(\)\{\}]/g, ' ').split(/[\s,\t]+/).filter(Boolean));

    const i0 = +t.dataset.i, j0 = +t.dataset.j;
    let filled = 0;
    rows.forEach((row, di) => {
      row.forEach((val, dj) => {
        const i = i0 + di, j = j0 + dj;
        if (i < state.n && j < state.n) { state.cells[i][j] = val; filled++; }
      });
    });

    buildGrid();
    validateAll();
    compute();
    S.toast(`Filled ${filled} cell${filled === 1 ? '' : 's'}`);
  }

  function validateAll() {
    let allGood = true;
    els.gridHost.querySelectorAll('.mx-in').forEach(inp => {
      if (!validateOne(inp, inp.value)) allGood = false;
    });
    return allGood;
  }

  /* ---------------- reading the matrix ---------------- */
  function readMatrix() {
    const n = state.n;
    const A = [];
    const bad = [];
    for (let i = 0; i < n; i++) {
      A.push([]);
      for (let j = 0; j < n; j++) {
        const raw = String(state.cells[i][j]).trim();
        if (raw === '') { A[i].push(F.ZERO); continue; }
        const f = F.parse(raw);
        if (!f) { bad.push({ i, j, raw }); A[i].push(F.ZERO); }
        else A[i].push(f);
      }
    }
    return { matrix: A, bad };
  }

  function readB() {
    const out = [], bad = [];
    for (let i = 0; i < state.n; i++) {
      const raw = String(state.b[i]).trim();
      if (raw === '') { out.push(F.ZERO); continue; }
      const f = F.parse(raw);
      if (!f) { bad.push(i); out.push(F.ZERO); }
      else out.push(f);
    }
    return { vector: out, bad };
  }

  /* ---------------- compute ---------------- */
  let timer = null;
  function scheduleCompute() {
    clearTimeout(timer);
    timer = setTimeout(compute, 260);
  }

  function compute() {
    clearTimeout(timer);
    const { matrix, bad } = readMatrix();

    if (bad.length) {
      els.gridError.classList.remove('hidden');
      clear(els.gridError);
      els.gridError.appendChild(icon(ICONS.alert));
      els.gridError.appendChild(h('div', {}, [
        h('span', { class : 'alert-title' }, bad.length === 1 ? 'One entry could not be read': `${bad.length} entries could not be read`),
        h('p', {}, bad.slice(0, 4).map(b => `row ${b.i + 1}, column ${b.j + 1}: “${b.raw}”`).join(' · ') +
          (bad.length > 4 ? ' …' : '')),
        h('p', { style: 'margin-top:4px' }, 'Use whole numbers, decimals like -1.5, or fractions like 2/7.')
      ]));
      state.result = null;
      renderResults();
      save();
      return;
    }
    els.gridError.classList.add('hidden');

    let res;
    try {
      res = LDU.factorize(matrix, { pivot: state.pivot, recordSteps: true });
    } catch (err) {
      state.result = null;
      renderResults();
      S.toast('Could not factor: ' + err.message, 3500);
      return;
    }
    state.result = res;

    state.solution = null;
    if (state.solve) {
      const { vector } = readB();
      try { state.solution = LDU.solve(res, vector); } catch (err) { state.solution = null; }
    }

    renderResults();
    save();
  }

  /* ---------------- status banner ---------------- */
  function renderStatus() {
    const host = els.statusHost;
    clear(host);
    const res = state.result;
    if (!res) return;

    const wrap = h('div', { class: 'stack-sm', style: 'margin-bottom:24px' });

    const headline = {
      'ldu': { cls: 'alert-ok', ico: 'check', title: 'A = L · D · U', text: 'The factorization exists with no row swaps, and the product has been verified against A entry by entry.' },
      'pldu': { cls: 'alert-info', ico: 'info', title: 'P · A = L · D · U', text: 'A row permutation was required, so the identity holds for the permuted matrix.' },
      'no-ldu': { cls: 'alert-err', ico: 'x', title: 'This matrix has no LDU factorization', text: '' },
      'needs-pivot': { cls: 'alert-err', ico: 'x', title: 'Stopped: a pivot is zero and swapping is disabled', text: '' },
      'trivial': { cls: 'alert-info', ico: 'info', title: 'Empty matrix', text: '' }
    }[res.status] || { cls: 'alert-info', ico: 'info', title: res.status, text: '' };

    wrap.appendChild(h('div', { class: 'alert ' + headline.cls, role: 'status' }, [
      icon(ICONS[headline.ico]),
      h('div', {}, [
        h('span', { class: 'alert-title', style: 'font-size:1.02rem' }, headline.title),
        headline.text ? h('p', {}, headline.text) : null
      ])
    ]));

    res.messages.forEach(m => {
      const cls = m.level === 'error' ? 'alert-err' : m.level === 'warn' ? 'alert-warn' : 'alert-info';
      const ic = m.level === 'error' ? 'x' : m.level === 'warn' ? 'alert' : 'lightbulb';
      wrap.appendChild(h('div', { class: 'alert ' + cls }, [icon(ICONS[ic]), h('div', {}, h('p', {}, m.text))]));
    });

    host.appendChild(wrap);
  }

  /* ---------------- tabs ---------------- */
  const TABS = [
    { id: 'factors', label: 'Factors' },
    { id: 'steps', label: 'Step by step' },
    { id: 'check', label: 'Verification' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'solve', label: 'Solve A·x = b' },
    { id: 'export', label: 'Export' }
  ];

  function renderTabs() {
    const host = els.tabsHost;
    clear(host);
    TABS.forEach(t => {
      const b = h('button', {
        type: 'button', role: 'tab',
        id: 'tab-' + t.id,
        'aria-selected': String(state.tab === t.id),
        'aria-controls': 'panel-' + t.id
      }, t.label);
      b.addEventListener('click', () => { state.tab = t.id; renderPanels(); renderTabs(); save(); });
      host.appendChild(b);
    });
  }

  /* ---------------- panels ---------------- */
  function renderPanels() {
    const host = els.panelsHost;
    clear(host);
    const res = state.result;
    if (!res) return;

    const panel = h('div', { id: 'panel-' + state.tab, role: 'tabpanel', 'aria-labelledby': 'tab-' + state.tab, class: 'anim-in' });

    switch (state.tab) {
      case 'factors': panelFactors(panel, res); break;
      case 'steps': panelSteps(panel, res); break;
      case 'check': panelCheck(panel, res); break;
      case 'analysis': panelAnalysis(panel, res); break;
      case 'solve': panelSolve(panel, res); break;
      case 'export': panelExport(panel, res); break;
    }
    host.appendChild(panel);
  }

  /* ---- Factors ---- */
  function panelFactors(panel, res) {
    const o = fmtOpts();

    if (res.status === 'needs-pivot') {
      panel.appendChild(h('div', { class: 'card' }, [
        h('h3', {}, 'Nothing to show'),
        h('p', { style: 'margin-top:8px' },
          'Pivoting is set to “never swap”, and elimination hit a zero pivot, so no factorization was produced. ' +
          'Change the pivoting strategy to continue, or read why this happens on the Theory page.'),
        h('a', { class: 'btn btn-soft btn-sm', href: 'theory.html#existence', style: 'margin-top:12px' }, 'The existence theorem →')
      ]));
      return;
    }

    /* the headline identity */
    const items = [];
    if (res.needsPermutation) {
      items.push({ name: 'P', matrix: res.P });
      items.push({ op: '·' });
    }
    items.push({ name: 'A', matrix: res.A });
    items.push({ op: '=' });
    items.push({ name: 'L', matrix: res.L, opts: { unit: true } });
    items.push({ op: '·' });
    items.push({ name: 'D', matrix: res.D, opts: { diag: true } });
    items.push({ op: '·' });
    items.push({ name: 'U', matrix: res.U, opts: { unit: true } });

    panel.appendChild(h('section', { class: 'card', style: 'margin-bottom:24px' }, [
      h('div', { class: 'card-head' }, [
        h('span', { class: 'card-ico' }, icon(ICONS.layers)),
        h('h2', { style : 'font-size:1.15rem' }, res.needsPermutation ? 'The permuted identity' : 'The identity'),
        h('span', { class: 'spacer' }),
        S.copyButton(() => R.resultToPlainText(res, fmtOpts()), 'Copy all')
      ]),
      R.equation(items, o)
    ]));

    /* individual factors */
    const cards = h('div', { class: 'grid grid-2' });

    cards.appendChild(factorCard('L', res.L, 'Unit lower triangular',
      'Each entry below the diagonal is the multiplier used to clear that position during elimination. The diagonal is all 1s by definition.',
      { unit: true }, res));

    cards.appendChild(factorCard('D', res.D, 'Diagonal',
      'The pivots, in the order they were used. Their product (times the sign of the permutation) is the determinant of A.',
      { diag: true }, res));

    cards.appendChild(factorCard('U', res.U, 'Unit upper triangular',
      'The eliminated matrix after each row has been divided by its own pivot, which puts 1s along the diagonal.',
      { unit: true }, res));

    cards.appendChild(factorCard('Û = D · U', res.Uhat, 'The eliminated matrix',
      'What Gaussian elimination actually produces before the diagonal is factored out. P·A = L·Û is the ordinary LU factorization.',
      { diag: true }, res, 'Uhat'));

    if (res.needsPermutation) {
      cards.appendChild(factorCard('P', res.P, 'Permutation',
        'Records the row swaps. Row i of P·A is row ' + res.perm.map(p => p + 1).join(', ') + ' of A, read off as the row order ' +
        R.permText(res.perm) + '. Since ' + res.swapCount + ' swap' + (res.swapCount === 1 ? '' : 's') +
        ' occurred, det P = ' + (res.swapCount % 2 ? '−1' : '+1') + '.',
        {}, res, 'P'));
    }

    if (res.isLDLt) {
      cards.appendChild(h('div', { class: 'card' }, [
        h('div', { class: 'card-head' }, [
          h('span', { class: 'card-ico' }, icon(ICONS.check)),
          h('h3', {}, 'Lᵀ')
        ]),
        h('p', { class: 'text-sm', style: 'margin-bottom:14px' },
          'A is symmetric, and U turned out to be exactly the transpose of L, so the factorization is A = L·D·Lᵀ. ' +
          'Only L and D need storing, which halves the work.'),
        R.scrollable(R.matrix(M.transpose(res.L), Object.assign({}, o, { unit: true, ariaLabel: 'L transpose' })))
      ]));
    }

    panel.appendChild(cards);
  }

  function factorCard(name, A, kind, blurb, opts, res, exportName) {
    const o = Object.assign({}, fmtOpts(), opts);
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-head' }, [
        h('span', { class: 'mx-name', style: 'font-size:1.4rem' }, name),
        h('span', { class: 'badge' }, kind),
        h('span', { class: 'spacer' }),
        S.copyButton(() => M.toText(A, fmtOpts()), name.replace(/[^A-Za-zÛ]/g, '') || 'matrix', { hideLabel: true })
      ]),
      R.scrollable(R.matrix(A, Object.assign({}, o, { rails: A.length > 1, ariaLabel: 'Matrix ' + name }))),
      h('p', { class: 'text-sm', style: 'margin-top:14px' }, blurb)
    ]);
  }

  /* ---- Steps ---- */
  function panelSteps(panel, res) {
    if (!res.steps.length) {
      panel.appendChild(h('p', {}, 'No steps were recorded.'));
      return;
    }

    const bar = h('div', { class: 'row', style: 'margin-bottom:18px' }, [
      h('p', { class: 'text-sm', style: 'margin:0;flex:1 1 260px' },
        'Phase 1 eliminates, building L and Û. Phase 2 divides each row of Û by its pivot to separate D from U. ' +
        'Open a stage to see the exact arithmetic.'),
      h('span', { class: 'spacer' })
    ]);

    const expand = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Expand all');
    const collapse = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Collapse all');
    bar.appendChild(expand); bar.appendChild(collapse);
    panel.appendChild(bar);

    const stepsEl = R.steps(res, fmtOpts());
    panel.appendChild(stepsEl);

    expand.addEventListener('click', () => stepsEl.querySelectorAll('details').forEach(d => d.open = true));
    collapse.addEventListener('click', () => stepsEl.querySelectorAll('details').forEach(d => d.open = false));
  }

  /* ---- Verification ---- */
  function panelCheck(panel, res) {
    const o = fmtOpts();
    const v = res.verification;
    const lu = LDU.verifyLU(res);

    panel.appendChild(h('div', { class : 'alert ' + (v.matches ? 'alert-ok' : 'alert-err'), style : 'margin-bottom:24px' }, [
      icon(v.matches ? ICONS.check : ICONS.x),
      h('div', {}, [
        h('span', { class: 'alert-title' }, v.matches
          ? 'The factorization is exact'
          : 'The factorization does not reproduce A'),
        h('p', {}, v.matches
          ? `Every one of the ${res.n * res.n} entries of L·D·U matches ${res.needsPermutation ? 'P·A' : 'A'} exactly. ` +
            'This is an equality of rational numbers, not a tolerance check; there is no “close enough” involved.'
              : 'This should never happen. Please report the matrix as a bug.')
      ])
    ]));

    panel.appendChild(h('section', { class: 'card', style: 'margin-bottom:24px' }, [
      h('div', { class: 'card-head' }, [
        h('span', { class: 'card-ico' }, icon(ICONS.check)),
        h('h3', {}, 'L · D · U compared with ' + (res.needsPermutation ? 'P · A' : 'A'))
      ]),
      R.equation([
        { name: 'L·D·U', matrix: v.product },
        { op: '=' },
        { name : res.needsPermutation ? 'P·A' : 'A', matrix : v.target }
      ], o),
      h('div', { style: 'margin-top:20px' }, [
        h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'Difference (every entry should be zero)'),
        R.scrollable(R.matrix(v.residual, Object.assign({}, o, { ariaLabel: 'Residual matrix' })))
      ])
    ]));

    panel.appendChild(h('section', { class: 'card' }, [
      h('div', { class: 'card-head' }, [
        h('span', { class: 'card-ico' }, icon(ICONS.layers)),
        h('h3', {}, 'The LU form as a cross-check'),
        h('span', { class: 'spacer' }),
        h('span', { class : 'badge ' + (lu.matches ? 'badge-ok' : 'badge-err') + ' badge-dot' },
          lu.matches ? 'holds' : 'fails')
      ]),
      h('p', { class: 'text-sm', style: 'margin-bottom:16px' },
        'Before the diagonal is split off, elimination produces ' + (res.needsPermutation ? 'P·A' : 'A') +
        ' = L·Û. This identity holds even for matrices that have no LDU factorization, which is why it is shown separately.'),
      R.equation([
        { name: 'L·Û', matrix: lu.product },
        { op: '=' },
        { name : res.needsPermutation ? 'P·A' : 'A', matrix : lu.target }
      ], o)
    ]));
  }

  /* ---- Analysis ---- */
  function panelAnalysis(panel, res) {
    const o = fmtOpts();

    /* stat tiles */
    const stats = h('div', { class: 'grid grid-4', style: 'margin-bottom:24px' });

    stats.appendChild(stat('Determinant', R.fmt(res.det, o),
      res.isSingular ? 'Zero; A is singular' : 'Product of the pivots' + (res.swapCount % 2 ? ', negated for the odd permutation' : '')));

    stats.appendChild(stat('Rank', res.rank + ' / ' + res.n,
      res.rank === res.n ? 'Full rank': `Nullity ${res.nullity}; the columns are dependent`));

    stats.appendChild(stat('Row swaps', String(res.swapCount),
      res.swapCount ? 'Order ' + R.permText(res.perm) : 'None needed'));

    stats.appendChild(stat('Trace', R.fmt(M.trace(res.A), o), 'Sum of the diagonal of A'));

    panel.appendChild(stats);

    /* properties */
    const props = [
      ['Square', true, 'Required for LDU.'],
      ['Invertible', !res.isSingular, res.isSingular ? 'det A = 0.' : 'det A ≠ 0, so A⁻¹ exists.'],
      ['Symmetric', res.isSymmetric, res.isSymmetric ? 'A = Aᵀ.' : 'A ≠ Aᵀ.'],
      ['LDLᵀ form', res.isLDLt, res.isLDLt ? 'U = Lᵀ, so only L and D are needed.' : 'Needs symmetry and no row swaps.'],
      ['Positive definite', res.isSPD, res.isSPD ? 'Symmetric with every pivot > 0 (Sylvester’s criterion).' : 'Not all pivots are positive, or A is not symmetric.'],
      ['Factored without P', !res.needsPermutation && res.status !== 'no-ldu', permutationReason(res)]
    ];

    const propWrap = h('div', { class: 'table-wrap', style: 'margin-bottom:24px' },
      h('table', { class: 'tbl' }, [
        h('thead', {}, h('tr', {}, [h('th', {}, 'Property'), h('th', {}, ''), h('th', {}, 'Why')])),
        h('tbody', {}, props.map(([name, yes, why]) => h('tr', {}, [
          h('td', {}, h('strong', {}, name)),
          h('td', {}, h('span', { class : 'badge ' + (yes ? 'badge-ok' : 'badge') + ' badge-dot' }, yes ? 'yes' : 'no')),
          h('td', {}, why)
        ])))
      ])
    );
    panel.appendChild(h('section', { class: 'card', style: 'margin-bottom:24px' }, [
      h('div', { class: 'card-head' }, [h('span', { class: 'card-ico' }, icon(ICONS.target)), h('h3', {}, 'Properties of A')]),
      propWrap
    ]));

    /* pivots & minors */
    const rowsHtml = [];
    for (let k = 0; k < res.n; k++) {
      const minor = res.minors[k];
      const d = res.D[k][k];
      rowsHtml.push(h('tr', {}, [
        h('td', {}, h('strong', {}, String(k + 1))),
        h('td', { class : 'num' }, res.pivots[k] ? R.fmt(res.pivots[k], o) : ', '),
        h('td', { class: 'num' }, R.fmt(d, o)),
        h('td', { class: 'num' }, R.fmt(minor, o)),
        h('td', {}, minor.isZero()
          ? h('span', { class : 'badge badge-warn badge-dot' }, 'zero')
          : h('span', { class: 'badge badge-ok badge-dot' }, 'non-zero'))
      ]));
    }

    panel.appendChild(h('section', { class: 'card', style: 'margin-bottom:24px' }, [
      h('div', { class: 'card-head' }, [
        h('span', { class: 'card-ico' }, icon(ICONS.sigma)),
        h('h3', {}, 'Pivots and leading principal minors')
      ]),
      h('p', { class: 'text-sm', style: 'margin-bottom:16px' }, [
        'The k-th leading principal minor D',
        h('sub', {}, 'k'),
        ' is the determinant of the top-left k×k block. A factors as L·D·U with no permutation exactly when D',
        h('sub', {}, '1'),
        ' … D',
        h('sub', {}, 'n−1'),
        ' are all non-zero, and in that case d',
        h('sub', {}, 'k'),
        ' = D',
        h('sub', {}, 'k'),
        ' / D',
        h('sub', {}, 'k−1'),
        '.'
      ]),
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, [
        h('thead', {}, h('tr', {}, [
          h('th', {}, 'k'), h('th', { class: 'num' }, 'pivot'), h('th', { class: 'num' }, 'dₖ'),
          h('th', { class: 'num' }, 'minor Dₖ'), h('th', {}, '')
        ])),
        h('tbody', {}, rowsHtml)
      ])),
      res.minorsAllNonzero && !res.isSingular
        ? h('p', { class : 'text-sm', style : 'margin-top:14px' },
          'Every minor is non-zero, which is why no row swap was needed. You can check the ratio rule above against the dₖ column.')
            : null
    ]));

    /* Cholesky */
    if (res.isSPD) {
      const ch = LDU.choleskyFromLDL(res);
      if (ch.ok) {
        panel.appendChild(h('section', { class: 'card' }, [
          h('div', { class: 'card-head' }, [
            h('span', { class: 'card-ico' }, icon(ICONS.check)),
            h('h3', {}, 'Cholesky factor R, where A = R · Rᵀ')
          ]),
          h('p', { class: 'text-sm', style: 'margin-bottom:16px' },
            'A is symmetric positive definite, so D has a real square root and R = L·√D gives the Cholesky factorization. ' +
            'The square roots are irrational in general, so these are the only decimal approximations on this page.'),
          R.scrollable(h('div', { class: 'mx' }, [
            h('span', { class: 'mx-bracket mx-bracket-l' }),
            (function () {
              const body = h('div', { class: 'mx-body', style: `grid-template-columns: repeat(${res.n}, auto)` });
              ch.R.forEach(row => row.forEach(x => body.appendChild(
                h('span', { class : 'mx-cell' + (x === 0 ? ' is-zero' : '') }, fixed(x)))));
              return body;
            })(),
            h('span', { class: 'mx-bracket mx-bracket-r' })
          ])),
          h('p', { class: 'text-sm', style: 'margin-top:12px' },
            '√dₖ = ' + ch.sqrtD.map(fixed).join(', ') + '.')
        ]));
      }
    }
  }

  /**
   * Why the factorization did or did not need a permutation. A row swap can
   * happen with no vanishing minor: the largest-pivot strategy reorders rows
   * on purpose, so the explanation has to distinguish the two.
   */
  function permutationReason(res) {
    const zero = LDU.firstZeroMinor(res.minors.slice(0, res.n - 1));

    if (!res.needsPermutation) {
      return res.status === 'no-ldu'
        ? 'No row swap could supply a pivot, and the factorization does not exist.'
        : 'Elimination found a usable pivot at every stage, so P is the identity.';
    }
    if (zero !== -1) {
      return `Leading principal minor D${sub(zero + 1)} = 0, so stage ${zero + 1} had no pivot and a row was brought up.`;
    }
    if (res.pivotMode === LDU.PIVOT.LARGEST) {
      return 'No pivot was zero: the largest-pivot strategy reorders rows for stability regardless.';
    }
    return 'A pivot vanished part-way through elimination, so a row had to be brought up.';
  }

  function fixed(x) {
    if (x === 0) return '0';
    const s = x.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }

  function stat(label, value, note) {
    return h('div', { class: 'stat' }, [
      h('span', { class: 'stat-label' }, label),
      h('span', { class: 'stat-value' }, value),
      note ? h('span', { class : 'stat-note' }, note) : null
    ]);
  }

  /* ---- Solve ---- */
  function panelSolve(panel, res) {
    const o = fmtOpts();

    if (!state.solve) {
      panel.appendChild(h('div', { class: 'card text-center', style: 'padding:40px 24px' }, [
        h('h3', {}, 'Solving is switched off'),
        h('p', { style: 'max-width:46ch;margin:10px auto 0' },
          'Turn on “Also solve A·x = b” in the panel on the left, then enter the right-hand side. ' +
          'The factorization turns the system into three easy passes instead of a full elimination.'),
        (function () {
          const b = h('button', { class: 'btn btn-soft', type: 'button', style: 'margin-top:18px' }, 'Switch it on');
          b.addEventListener('click', () => { els.solveToggle.checked = true; els.solveToggle.dispatchEvent(new Event('change')); });
          return b;
        })()
      ]));
      return;
    }

    const sol = state.solution;
    if (!sol) {
      panel.appendChild(h('p', {}, 'Enter a right-hand side to solve the system.'));
      return;
    }

    const kindMap = {
      'unique': { cls: 'alert-ok', ico: 'check', title: 'Exactly one solution' },
      'singular-consistent': { cls: 'alert-warn', ico: 'alert', title: 'Infinitely many solutions' },
      'inconsistent': { cls: 'alert-err', ico: 'x', title: 'No solution' },
      'unavailable': { cls: 'alert-err', ico: 'x', title: 'Cannot solve through this factorization' }
    }[sol.kind];

    panel.appendChild(h('div', { class: 'alert ' + kindMap.cls, style: 'margin-bottom:24px' }, [
      icon(ICONS[kindMap.ico]),
      h('div', {}, [h('span', { class: 'alert-title' }, kindMap.title), h('p', {}, sol.message)])
    ]));

    if (sol.x) {
      const eqItems = [
        { name: 'A', matrix: res.A },
        { op: '·' },
        { name: 'x', matrix: sol.x.map(v => [v]) },
        { op: '=' },
        { name: 'b', matrix: sol.b.map(v => [v]) }
      ];
      panel.appendChild(h('section', { class: 'card', style: 'margin-bottom:24px' }, [
        h('div', { class: 'card-head' }, [
          h('span', { class: 'card-ico' }, icon(ICONS.target)),
          h('h3', {}, 'The solution'),
          h('span', { class: 'spacer' }),
          h('span', { class : 'badge ' + (sol.residualOk ? 'badge-ok' : 'badge-err') + ' badge-dot' },
            sol.residualOk ? 'A·x = b verified' : 'check failed'),
          S.copyButton(() => sol.x.map(v => R.fmt(v, fmtOpts())).join('\n'), 'x')
        ]),
        R.equation(eqItems, o),
        h('p', { class: 'text-sm', style: 'margin-top:16px' },
          'x = (' + sol.x.map(v => R.fmt(v, o)).join(', ') + '). Substituted back into the original A, this reproduces b exactly.')
      ]));
    }

    if (res.needsPermutation) {
      panel.appendChild(h('div', { class: 'alert alert-info', style: 'margin-bottom:24px' }, [
        icon(ICONS.info),
        h('div', {}, [
          h('span', { class: 'alert-title' }, 'The right-hand side is permuted too'),
          h('p', {}, 'Because rows of A were swapped, the same swaps are applied to b before substitution: P·b = (' +
            sol.Pb.map(v => R.fmt(v, o)).join(', ') + ').')
        ])
      ]));
    }

    panel.appendChild(h('section', { class: 'card', style: 'margin-bottom:24px' }, [
      h('div', { class: 'card-head' }, [
        h('span', { class: 'card-ico' }, icon(ICONS.layers)),
        h('h3', {}, 'Three passes instead of one elimination')
      ]),
      h('p', { class: 'text-sm', style: 'margin-bottom:18px' },
        'This is the practical payoff of factorizing: once L, D and U are known, any number of right-hand sides ' +
        'can be solved with only substitution; no elimination is repeated.'),
      R.solveSteps(sol, res, o)
    ]));

    /* inverse */
    const inv = LDU.inverse(res);
    panel.appendChild(h('section', { class: 'card' }, [
      h('div', { class: 'card-head' }, [
        h('span', { class: 'card-ico' }, icon(ICONS.refresh)),
        h('h3', {}, 'Inverse'),
        h('span', { class: 'spacer' }),
        inv.ok ? S.copyButton(() => M.toText(inv.matrix, fmtOpts()), 'A inverse') : null
      ]),
      inv.ok
        ? h('div', {}, [
          h('p', { class: 'text-sm', style: 'margin-bottom:16px' },
            'Solving A·xⱼ = eⱼ once per column, reusing the same factorization, gives A⁻¹ directly. ' + inv.message),
          R.scrollable(R.matrix(inv.matrix, Object.assign({}, o, { rails: true, ariaLabel: 'Inverse of A' })))
        ])
          : h('p', {}, inv.message)
    ]));
  }

  /* ---- Export ---- */
  function panelExport(panel, res) {
    // Exports round rather than truncate: a trailing "…" would make the
    // numbers unusable wherever the text is pasted.
    const text = R.resultToPlainText(res, Object.assign({}, fmtOpts(), { round: true }));
    const latex = R.resultToLatex(res);

    const block = (title, body, filename, mime) => {
      const pre = h('pre', { class: 'block', style: 'max-height:340px' }, body);
      return h('section', { class: 'card', style: 'margin-bottom:24px' }, [
        h('div', { class: 'card-head' }, [
          h('h3', {}, title),
          h('span', { class: 'spacer' }),
          S.copyButton(() => body, title),
          (function () {
            const b = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, [icon(ICONS.download), 'Download']);
            b.addEventListener('click', () => S.downloadText(filename, body, mime));
            return b;
          })()
        ]),
        pre
      ]);
    };

    panel.appendChild(block('Plain text report', text, 'ldu-factorization.txt', 'text/plain'));
    panel.appendChild(block('LaTeX', latex, 'ldu-factorization.tex', 'text/x-tex'));

    const json = JSON.stringify({
      n: res.n,
      A: res.A.map(r => r.map(v => v.toFractionString())),
      L: res.L.map(r => r.map(v => v.toFractionString())),
      D: res.D.map(r => r.map(v => v.toFractionString())),
      U: res.U.map(r => r.map(v => v.toFractionString())),
      permutation: res.perm.map(p => p + 1),
      determinant: res.det.toFractionString(),
      rank: res.rank,
      status: res.status,
      verified: res.verification.matches
    }, null, 2);
    panel.appendChild(block('JSON', json, 'ldu-factorization.json', 'application/json'));
  }

  /* ---------------- render ---------------- */
  function renderResults() {
    renderStatus();
    const has = !!state.result;
    els.resultsShell.classList.toggle('hidden', !has);
    els.emptyState.classList.toggle('hidden', has);
    if (has) { renderTabs(); renderPanels(); }
  }

  /* ---------------- fill buttons ---------------- */
  const FILLS = [
    { label: 'Zeros', make: n => M.zeros(n, n) },
    { label: 'Identity', make: n => M.identity(n) },
    { label: 'Random', make: n => M.randomMatrix(n, -6, 9) },
    { label: 'Factorable', make: n => M.randomFactorable(n), title: 'A random matrix built from integer L, D and U, so it factors cleanly' },
    { label: 'Symmetric', make: n => M.randomSymmetric(n, -5, 8) },
    { label: 'Pos. definite', make: n => M.randomSPD(n), title: 'Symmetric positive definite, so U = Lᵀ and every pivot is positive' },
    { label: 'Singular', make: n => M.randomSingular(n), title: 'The last row is a combination of earlier rows, so det A = 0' },
    { label: 'Needs swap', make: n => M.randomNeedsPivot(n), title: 'The (1,1) entry is zero, forcing a row permutation' },
    { label: 'Tridiagonal', make: n => M.randomTridiagonal(n) },
    { label: 'Transpose', make: (n, cur) => M.transpose(cur), title: 'Transpose whatever is currently entered' }
  ];

  function buildFills() {
    const host = els.fillHost;
    clear(host);
    FILLS.forEach(f => {
      const b = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: f.title || f.label }, f.label);
      b.addEventListener('click', () => {
        const cur = readMatrix().matrix;
        const A = f.make(state.n, cur);
        state.cells = matrixToCells(A);
        state.exampleId = '';
        els.exampleSelect.value = '';
        els.exampleNote.textContent = '';
        buildGrid();
        compute();
      });
      host.appendChild(b);
    });
  }

  /* ---------------- examples dropdown ---------------- */
  function buildExampleSelect() {
    const sel = els.exampleSelect;
    clear(sel);
    sel.appendChild(h('option', { value: '' }, ', choose an example, '));
    E.GROUPS.forEach(g => {
      const og = h('optgroup', { label: g.title });
      E.byGroup(g.id).forEach(ex => og.appendChild(h('option', { value: ex.id }, ex.title + '  (' + ex.rows.length + '×' + ex.rows.length + ')')));
      sel.appendChild(og);
    });
    sel.addEventListener('change', () => {
      const ex = E.byId(sel.value);
      if (ex) loadExample(ex, true);
    });
  }

  function loadExample(ex, recompute) {
    state.n = clampN(ex.rows.length);
    state.cells = ex.rows.map(r => r.slice());
    state.b = Array.from({ length: state.n }, (_, i) => (ex.b && ex.b[i]) || '0');
    state.exampleId = ex.id;
    if (ex.b) state.solve = true;

    syncControls();
    buildGrid();
    buildBGrid();
    if (els.exampleSelect) els.exampleSelect.value = ex.id;
    if (els.exampleNote) els.exampleNote.textContent = ex.note;
    if (recompute !== false) compute();
  }

  /* ---------------- control sync ---------------- */
  function syncControls() {
    els.sizeInput.value = state.n;
    els.modeFrac.setAttribute('aria-pressed', String(state.mode === 'fraction'));
    els.modeDec.setAttribute('aria-pressed', String(state.mode === 'decimal'));
    els.placesWrap.classList.toggle('hidden', state.mode !== 'decimal');
    els.placesInput.value = state.places;
    els.pivotSelect.value = state.pivot;
    els.solveToggle.checked = state.solve;
    els.bPanel.classList.toggle('hidden', !state.solve);
    els.pivotHint.textContent = {
      'when-zero': 'Keeps P as the identity whenever the matrix allows it: the best default for learning.',
      'never': 'Shows the strict textbook result: if a pivot is zero, there is no factorization.',
      'largest': 'What numerical libraries do for stability. With exact arithmetic it changes P but not correctness.'
    }[state.pivot];
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    /* size */
    const setSize = n => {
      const nn = clampN(n);
      if (nn === state.n) { els.sizeInput.value = nn; return; }
      state.cells = blankCells(nn, state.cells);
      state.b = Array.from({ length: nn }, (_, i) => state.b[i] || '0');
      state.n = nn;
      syncControls();
      buildGrid();
      buildBGrid();
      compute();
    };
    els.sizeInput.addEventListener('change', e => setSize(e.target.value));
    els.sizeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); setSize(e.target.value); } });
    els.sizeDec.addEventListener('click', () => setSize(state.n - 1));
    els.sizeInc.addEventListener('click', () => setSize(state.n + 1));

    /* display mode */
    els.modeFrac.addEventListener('click', () => { state.mode = 'fraction'; syncControls(); renderResults(); save(); });
    els.modeDec.addEventListener('click', () => { state.mode = 'decimal'; syncControls(); renderResults(); save(); });

    const setPlaces = p => {
      p = Math.min(12, Math.max(1, parseInt(p, 10) || 4));
      state.places = p;
      els.placesInput.value = p;
      renderResults(); save();
    };
    els.placesInput.addEventListener('change', e => setPlaces(e.target.value));
    els.placesDec.addEventListener('click', () => setPlaces(state.places - 1));
    els.placesInc.addEventListener('click', () => setPlaces(state.places + 1));

    /* pivoting */
    els.pivotSelect.addEventListener('change', e => {
      state.pivot = e.target.value;
      syncControls();
      compute();
    });

    /* solve toggle */
    els.solveToggle.addEventListener('change', e => {
      state.solve = e.target.checked;
      els.bPanel.classList.toggle('hidden', !state.solve);
      if (state.solve && state.tab !== 'solve') { state.tab = 'solve'; }
      compute();
    });

    /* paste panel */
    els.pasteToggle.addEventListener('click', () => {
      const hidden = els.pastePanel.classList.toggle('hidden');
      if (!hidden) els.pasteArea.focus();
    });
    els.pasteCancel.addEventListener('click', () => els.pastePanel.classList.add('hidden'));
    els.pasteApply.addEventListener('click', () => {
      const parsed = M.parseText(els.pasteArea.value);
      if (!parsed.ok) { S.toast(parsed.error, 3800); return; }
      if (parsed.n > MAX_N) { S.toast(`That matrix is ${parsed.n}×${parsed.n}; the maximum is ${MAX_N}×${MAX_N}.`, 3800); return; }
      state.n = clampN(parsed.n);
      state.cells = matrixToCells(parsed.matrix);
      state.b = Array.from({ length: state.n }, (_, i) => state.b[i] || '0');
      state.exampleId = '';
      els.exampleSelect.value = '';
      els.exampleNote.textContent = '';
      syncControls();
      buildGrid();
      buildBGrid();
      compute();
      els.pastePanel.classList.add('hidden');
      S.toast(parsed.reshaped
        ? `Folded ${parsed.n * parsed.n} values into a ${parsed.n}×${parsed.n} matrix`
        : `Loaded a ${parsed.n}×${parsed.n} matrix`);
    });

    /* share link */
    els.linkCopy.addEventListener('click', () => {
      const url = location.href.split('#')[0] + encodeHash();
      S.copyText(url, 'Link');
    });

    /* icons declared in markup */
    document.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      if (ICONS[name]) el.appendChild(icon(ICONS[name]));
    });

    window.addEventListener('hashchange', () => {
      if (applyHash()) { syncControls(); buildGrid(); buildBGrid(); compute(); }
    });
  }

  /* ---------------- boot ---------------- */
  function start() {
    els.gridHost = $('grid-host');
    els.gridError = $('grid-error');
    els.bHost = $('b-host');
    els.bPanel = $('b-panel');
    els.sizeInput = $('size-input');
    els.sizeDec = $('size-dec');
    els.sizeInc = $('size-inc');
    els.modeFrac = $('mode-frac');
    els.modeDec = $('mode-dec');
    els.placesWrap = $('places-wrap');
    els.placesInput = $('places-input');
    els.placesDec = $('places-dec');
    els.placesInc = $('places-inc');
    els.pivotSelect = $('pivot-select');
    els.pivotHint = $('pivot-hint');
    els.solveToggle = $('solve-toggle');
    els.exampleSelect = $('example-select');
    els.exampleNote = $('example-note');
    els.fillHost = $('fill-host');
    els.pasteToggle = $('paste-toggle');
    els.pastePanel = $('paste-panel');
    els.pasteArea = $('paste-area');
    els.pasteApply = $('paste-apply');
    els.pasteCancel = $('paste-cancel');
    els.linkCopy = $('link-copy');
    els.statusHost = $('status-host');
    els.resultsShell = $('results-shell');
    els.emptyState = $('empty-state');
    els.tabsHost = $('tabs-host');
    els.panelsHost = $('panels-host');

    // Load order: URL hash wins, then saved session, then a default example.
    const fromHash = applyHash();
    if (!fromHash) {
      const restored = load();
      if (!restored) {
        const ex = E.byId('classic-3x3');
        state.n = ex.rows.length;
        state.cells = ex.rows.map(r => r.slice());
        state.b = ex.b.slice();
        state.exampleId = ex.id;
      }
    }
    if (!state.cells.length) state.cells = blankCells(state.n);
    if (!state.b.length) state.b = Array.from({ length: state.n }, () => '0');

    buildExampleSelect();
    buildFills();
    wire();
    syncControls();
    buildGrid();
    buildBGrid();

    if (state.exampleId) {
      els.exampleSelect.value = state.exampleId;
      const ex = E.byId(state.exampleId);
      if (ex) els.exampleNote.textContent = ex.note;
    }

    compute();
  }

  S.ready(start);
})();
