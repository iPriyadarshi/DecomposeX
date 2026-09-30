/* ============================================================
   algorithm.js, live demonstrations for the Algorithm page
   Including a genuine double-precision implementation, run
   side by side with the exact one, so the floating-point
   failures on this page are measured rather than asserted.
   ============================================================ */
(function () {
  'use strict';

  const F = window.Fraction, M = window.Mat, LDU = window.LDU;
  const S = window.Site, R = window.Render, E = window.ExampleData;
  const h = S.h, icon = S.icon, ICONS = S.ICONS;

  function figure(content, caption) {
    return h('figure', { class: 'panel', style: 'margin:20px 0;display:grid;gap:12px' }, [
      h('div', { class: 'mx-scroll' }, content),
      caption ? h('figcaption', { class : 'text-sm text-mute' }, caption) : null
    ]);
  }

  /* ------------------------------------------------------------
     A deliberately naive double-precision factorization: the
     same arithmetic a typical textbook implementation performs,
     with no pivot test at all. Used only to show what goes wrong.
     ------------------------------------------------------------ */
  function floatLDU(Anum) {
    const n = Anum.length;
    const W = Anum.map(r => r.slice());
    const L = [];
    for (let i = 0; i < n; i++) { L.push(new Array(n).fill(0)); L[i][i] = 1; }
    const pivots = [];

    for (let k = 0; k < n; k++) {
      pivots.push(W[k][k]);
      for (let i = k + 1; i < n; i++) {
        const m = W[i][k] / W[k][k];        // no guard; this is the point
        L[i][k] = m;
        for (let j = k; j < n; j++) W[i][j] -= m * W[k][j];
      }
    }
    return { pivots, L, Uhat: W, det: pivots.reduce((a, b) => a * b, 1) };
  }

  function num(x) {
    if (!isFinite(x)) return x > 0 ? '+Infinity' : (Number.isNaN(x) ? 'NaN' : '−Infinity');
    if (Number.isNaN(x)) return 'NaN';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a < 1e-4 || a >= 1e7) return x.toExponential(4);
    return String(Number(x.toPrecision(12)));
  }

  /* ---------- elementary matrices ---------- */
  function elementaryDemo() {
    const host = document.getElementById('elementary-demo');
    if (!host) return;

    const res = LDU.factorize(E.toMatrix(E.byId('classic-3x3')), { recordSteps: false });
    const Es = LDU.elementaryMatrices(res);
    if (!Es.length) return;

    const items = [];
    Es.slice().reverse().forEach((e, idx) => {
      items.push({ name: 'E' + R.sub(e.k + 1), matrix: e.E });
      items.push({ op: '·' });
    });
    items.push({ name: 'A', matrix: res.A });
    items.push({ op: '=' });
    items.push({ name: 'Û', matrix: res.Uhat, opts: { diag: true } });

    // And the product of the inverses, which is L.
    const invItems = [];
    Es.forEach((e, i) => {
      const inv = M.clone(e.E);
      for (let r = 0; r < res.n; r++) for (let c = 0; c < res.n; c++) if (r !== c) inv[r][c] = e.E[r][c].neg();
      invItems.push({ name: 'E' + R.sub(e.k + 1) + '⁻¹', matrix: inv });
      if (i < Es.length - 1) invItems.push({ op: '·' });
    });
    invItems.push({ op: '=' });
    invItems.push({ name: 'L', matrix: res.L, opts: { unit: true } });

    host.appendChild(figure(
      h('div', { style: 'display:grid;gap:18px' }, [
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'Elimination as a product'),
          R.equation(items)
        ]),
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'Undoing it collapses into L'),
          R.equation(invItems)
        ])
      ]),
      'Each Eₖ holds the negated multipliers of one stage. Inverting simply flips their signs, and the product of the inverses is L, which is why the multipliers can be written straight into L with no extra arithmetic.'
    ));
  }

  /* ---------- the full walkthrough ---------- */
  function walkthrough() {
    const host = document.getElementById('walkthrough-demo');
    if (!host) return;

    const ex = E.byId('classic-3x3');
    const res = LDU.factorize(E.toMatrix(ex));

    const bar = h('div', { class: 'row', style: 'margin-bottom:14px' }, [
      h('span', { class: 'badge badge-brand' }, 'A = ' + ex.rows.map(r => r.join(' ')).join('; ')),
      h('span', { class: 'spacer' })
    ]);
    const expand = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Expand all');
    bar.appendChild(expand);

    const stepsEl = R.steps(res);
    expand.addEventListener('click', () => {
      const all = Array.from(stepsEl.querySelectorAll('details'));
      const anyClosed = all.some(d => !d.open);
      all.forEach(d => d.open = anyClosed);
      expand.textContent = anyClosed ? 'Collapse all' : 'Expand all';
    });

    host.appendChild(h('div', {}, [bar, stepsEl]));
  }

  /* ---------- the three pivot cases ---------- */
  function pivotCases() {
    const host = document.getElementById('pivot-cases-demo');
    if (!host) return;

    const cases = [
      { id: 'swap-3x3', label: 'Case 1, swap and continue' },
      { id: 'singular-rank1', label: 'Case 2, zero pivot, empty row' },
      { id: 'no-ldu', label: 'Case 3, zero pivot, non-empty row' }
    ];

    const grid = h('div', { class: 'grid grid-3', style: 'margin:20px 0' });

    cases.forEach(c => {
      const ex = E.byId(c.id);
      const res = LDU.factorize(E.toMatrix(ex), { recordSteps: false });

      const verdict = res.status === 'no-ldu'
        ? h('span', { class : 'badge badge-err badge-dot' }, 'no LDU exists')
        : res.needsPermutation
          ? h('span', { class : 'badge badge-info badge-dot' }, 'P·A = L·D·U')
          : res.isSingular
            ? h('span', { class : 'badge badge-warn badge-dot' }, 'A = L·D·U, U not unique')
            : h('span', { class: 'badge badge-ok badge-dot' }, 'A = L·D·U');

      grid.appendChild(h('div', { class: 'card card-sm' }, [
        h('div', { class: 'step-tag', style: 'margin-bottom:10px' }, c.label),
        h('div', { class: 'mx-scroll', style: 'margin-bottom:12px' }, R.matrix(res.A)),
        h('div', { class: 'row', style: 'gap:6px;margin-bottom:10px' }, [
          verdict,
          h('span', { class: 'badge' }, 'rank ' + res.rank + '/' + res.n)
        ]),
        h('p', { class: 'text-sm', style: 'margin:0' }, [
          'Pivots: ',
          h('span', { class: 'mono' }, res.pivots.map(p => p.toFractionString()).join(', ')),
          '. ',
          h('a', { class: 'link', href: 'calculator.html#m=' + encodeURIComponent(ex.rows.map(r => r.join(',')).join(';')) }, 'Open in the calculator →')
        ])
      ]));
    });

    host.appendChild(grid);
  }

  /* ---------- exact vs floating point ---------- */
  function fpDemo() {
    const host = document.getElementById('fp-demo');
    if (!host) return;

    /* ---- Failure 1: a pivot that really is 0.0 → Infinity, NaN ---- */
    const loudRows = [['1', '2', '3'], ['2', '4', '7'], ['3', '5', '3']];
    const loudA = M.from(loudRows);
    const loudExact = LDU.factorize(loudA, { recordSteps: false });
    const loudFloat = floatLDU(loudRows.map(r => r.map(v => Number(v))));

    /* ---- Failure 2: exactly singular, but float thinks otherwise ---- */
    const quietRows = [['4/7', '5/7', '8/9'], ['1/3', '7/6', '8/9'], ['15/7', '69/14', '40/9']];
    const quietA = M.from(quietRows);
    const quietExact = LDU.factorize(quietA, { recordSteps: false });
    const quietFloat = floatLDU(quietA.map(r => r.map(v => v.toNumber())));

    const compare = (title, rows, exact, flt, blurb, floatVerdict, exactVerdict) =>
      h('div', { class: 'card', style: 'margin:20px 0' }, [
        h('div', { class: 'card-head' }, [
          h('span', { class: 'card-ico' }, icon(ICONS.alert)),
          h('h4', { style: 'margin:0' }, title)
        ]),
        h('p', { class: 'text-sm', style: 'margin-bottom:16px' }, blurb),
        h('div', { class: 'mx-scroll', style: 'margin-bottom:18px' },
          R.equation([{ name: 'A', matrix: exact.A }])),
        h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, [
          h('thead', {}, h('tr', {}, [
            h('th', {}, ''), h('th', {}, 'Exact rational arithmetic'), h('th', {}, 'IEEE-754 doubles')
          ])),
          h('tbody', {}, [
            h('tr', {}, [
              h('td', {}, h('strong', {}, 'Pivots')),
              h('td', { class: 'num' }, exact.pivots.map(p => p.toFractionString()).join(', ')),
              h('td', { class: 'num' }, flt.pivots.map(num).join(', '))
            ]),
            h('tr', {}, [
              h('td', {}, h('strong', {}, 'Is the last pivot zero?')),
              h('td', {}, exact.pivots[exact.n - 1] && exact.pivots[exact.n - 1].isZero()
                ? h('span', { class : 'badge badge-ok badge-dot' }, 'yes, detected')
                : h('span', { class: 'badge' }, 'no')),
              h('td', {}, flt.pivots[flt.pivots.length - 1] === 0
                ? h('span', { class : 'badge badge-ok badge-dot' }, 'yes')
                : h('span', { class: 'badge badge-err badge-dot' }, 'no, missed'))
            ]),
            h('tr', {}, [
              h('td', {}, h('strong', {}, 'det A')),
              h('td', { class: 'num' }, exact.det.toFractionString()),
              h('td', { class: 'num' }, num(flt.det))
            ]),
            h('tr', {}, [
              h('td', {}, h('strong', {}, 'Multiplier ℓ₂₁')),
              h('td', { class: 'num' }, exact.L[1][0].toFractionString()),
              h('td', { class: 'num' }, num(flt.L[1][0]))
            ]),
            h('tr', {}, [
              h('td', {}, h('strong', {}, 'Verdict')),
              h('td', {}, h('span', { class: 'badge badge-ok badge-dot' }, exactVerdict)),
              h('td', {}, h('span', { class: 'badge badge-err badge-dot' }, floatVerdict))
            ])
          ])
        ]))
      ]);

    host.appendChild(compare(
      'Failure 1, division by an exactly-zero pivot',
      loudRows, loudExact, loudFloat,
      'This matrix is invertible, but its second pivot is exactly zero, so it needs a row swap. A naive ' +
      'implementation divides anyway.',
      'produces Infinity and NaN',
      'swaps rows, reports P·A = L·D·U'
    ));

    host.appendChild(compare(
      'Failure 2: a singular matrix reported as invertible',
      quietRows, quietExact, quietFloat,
      'Every entry here is a simple fraction, and the third row is exactly 2·(row 1) + 3·(row 2), so the matrix ' +
      'is singular and its determinant is exactly 0. In double precision, cancellation leaves a pivot near ' +
      '10⁻¹⁶ instead of 0, and nothing flags the problem.',
      'reports a non-zero determinant',
      'det A = 0, rank ' + quietExact.rank + ' of ' + quietExact.n
    ));

    host.appendChild(h('p', { class: 'text-sm text-mute' },
      'Both tables are computed in your browser when this page loads; the right-hand column is a real ' +
      'double-precision run of the same algorithm, not a quoted figure.'));
  }

  function start() {
    elementaryDemo();
    walkthrough();
    pivotCases();
    fpDemo();

    document.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      if (ICONS[name]) el.appendChild(icon(ICONS[name]));
    });

    S.buildToc('.prose', '#toc-host');
  }

  S.ready(start);
})();
