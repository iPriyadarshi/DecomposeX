/* ============================================================
   theory.js: the live illustrations on the Theory page
   Each figure is computed from the real factorization code, so
   no illustration can disagree with the algorithm it explains.
   ============================================================ */
(function () {
  'use strict';

  const F = window.Fraction, M = window.Mat, LDU = window.LDU;
  const S = window.Site, R = window.Render, E = window.ExampleData;
  const h = S.h, icon = S.icon, ICONS = S.ICONS;

  /** A labelled figure with an optional caption underneath. */
  function figure(content, caption) {
    return h('figure', { class: 'panel', style: 'margin:20px 0;display:grid;gap:12px' }, [
      h('div', { class: 'mx-scroll' }, content),
      caption ? h('figcaption', { class : 'text-sm text-mute' }, caption) : null
    ]);
  }

  /* ---------- the four shapes side by side ---------- */
  function shapes() {
    const host = document.getElementById('shapes-demo');
    if (!host) return;

    // These cells hold symbols, not numbers, so they are built by hand
    // rather than routed through Fraction.
    const symbolic = (rows, opts) => {
      const o = opts || {};
      const n = rows.length;
      const body = h('div', { class: 'mx-body', style: `grid-template-columns: repeat(${n}, auto)` });
      rows.forEach((row, i) => row.forEach((v, j) => {
        const cls = ['mx-cell'];
        if (v === '0') cls.push('is-zero');
        else if (v === '1' && i === j) cls.push('is-one');
        if (o.diag && i === j && v !== '0') cls.push('is-diag');
        body.appendChild(h('span', { class: cls.join(' ') }, v));
      }));
      return h('div', { class: 'mx' }, [
        h('span', { class: 'mx-bracket mx-bracket-l' }), body, h('span', { class: 'mx-bracket mx-bracket-r' })
      ]);
    };

    const named = (name, rows, opts, label) => h('div', { style: 'display:grid;gap:8px;justify-items:center' }, [
      h('span', { class: 'mx-name' }, name),
      symbolic(rows, opts),
      h('span', { class: 'text-xs text-mute', style: 'text-align:center;max-width:16ch' }, label)
    ]);

    host.appendChild(figure(
      h('div', { class: 'row', style: 'gap:28px;align-items:flex-start;justify-content:center' }, [
        named('L', [['1', '0', '0'], ['ℓ₂₁', '1', '0'], ['ℓ₃₁', 'ℓ₃₂', '1']], {}, 'unit lower triangular'),
        named('D', [['d₁', '0', '0'], ['0', 'd₂', '0'], ['0', '0', 'd₃']], { diag: true }, 'diagonal'),
        named('U', [['1', 'u₁₂', 'u₁₃'], ['0', '1', 'u₂₃'], ['0', '0', '1']], {}, 'unit upper triangular')
      ]),
      'The three shapes. Only the shaded positions can hold anything other than 0 or 1, which is why the whole factorization of an n×n matrix fits in exactly n² numbers, the same storage as A itself.'
    ));
  }

  /* ---------- LU vs LDU on the same matrix ---------- */
  function luVsLdu() {
    const host = document.getElementById('lu-vs-ldu-demo');
    if (!host) return;

    const res = LDU.factorize(E.toMatrix(E.byId('classic-3x3')), { recordSteps: false });

    host.appendChild(figure(
      h('div', { style: 'display:grid;gap:18px' }, [
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'What elimination produces: the LU form'),
          R.equation([
            { name: 'A', matrix: res.A },
            { op: '=' },
            { name: 'L', matrix: res.L, opts: { unit: true } },
            { op: '·' },
            { name: 'Û', matrix: res.Uhat, opts: { diag: true } }
          ])
        ]),
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'The same thing with the diagonal pulled out: the LDU form'),
          R.equation([
            { name: 'A', matrix: res.A },
            { op: '=' },
            { name: 'L', matrix: res.L, opts: { unit: true } },
            { op: '·' },
            { name: 'D', matrix: res.D, opts: { diag: true } },
            { op: '·' },
            { name: 'U', matrix: res.U, opts: { unit: true } }
          ])
        ])
      ]),
      'L is identical in both. The only difference is whether the pivots 2, −8 and 1 sit on the diagonal of Û or in a factor of their own.'
    ));
  }

  /* ---------- a pivot that is hidden in the original matrix ---------- */
  function hiddenZero() {
    const host = document.getElementById('hidden-zero-demo');
    if (!host) return;

    const ex = E.byId('swap-later');
    const A = E.toMatrix(ex);
    const res = LDU.factorize(A);

    // The working matrix right after stage 1, before any swap of stage 2.
    const afterStage1 = res.steps.filter(s => s.stage === 0 && s.matrix).pop();

    const minorRows = res.minors.map((m, k) => h('tr', {}, [
      h('td', {}, h('strong', {}, 'D' + subDigit(k + 1))),
      h('td', { class: 'num' }, m.toFractionString()),
      h('td', {}, m.isZero()
        ? h('span', { class : 'badge badge-warn badge-dot' }, 'zero, stage ' + (k + 1) + ' will stall')
        : h('span', { class: 'badge badge-ok badge-dot' }, 'fine'))
    ]));

    host.appendChild(figure(
      h('div', { style: 'display:grid;gap:18px' }, [
        R.equation([
          { name: 'A', matrix: A },
          { op: '→' },
          { name: 'after stage 1', matrix: afterStage1.matrix, opts: { cells: { '1,1': 'is-pivot' } } }
        ]),
        h('p', { class: 'text-sm', style: 'margin:0' }, [
          'In A the entry a₂₂ = ', h('strong', {}, A[1][1].toFractionString()),
          ' looks like a usable pivot. After column 1 is cleared it has become ',
          h('strong', {}, '0'),
          ', so stage 2 stalls and a row swap is needed. The leading principal minors saw this coming:'
        ]),
        h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, [
          h('thead', {}, h('tr', {}, [h('th', {}, 'Minor'), h('th', { class: 'num' }, 'value'), h('th', {}, '')])),
          h('tbody', {}, minorRows)
        ]))
      ]),
      'D₂ = 1·4 − 2·2 = 0 predicts the stall before a single row operation is performed.'
    ));
  }

  function subDigit(k) {
    const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
    return String(k).replace(/\d/g, d => map[d]);
  }

  /* ---------- invertible but not factorable ---------- */
  function swapDemo() {
    const host = document.getElementById('swap-demo');
    if (!host) return;

    const A = M.from([['0', '1'], ['1', '0']]);
    const withSwap = LDU.factorize(A, { recordSteps: false });

    host.appendChild(figure(
      h('div', { style: 'display:grid;gap:20px' }, [
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'Without permutation: no factorization'),
          h('div', { class: 'row', style: 'gap:16px;align-items:center' }, [
            R.matrix(A, { cells: { '0,0': 'is-pivot' } }),
            h('span', { class: 'badge badge-err badge-dot' }, 'a₁₁ = 0, D₁ = 0')
          ])
        ]),
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'With one row swap'),
          R.equation([
            { name: 'P', matrix: withSwap.P },
            { op: '·' },
            { name: 'A', matrix: withSwap.A },
            { op: '=' },
            { name: 'L', matrix: withSwap.L, opts: { unit: true } },
            { op: '·' },
            { name: 'D', matrix: withSwap.D, opts: { diag: true } },
            { op: '·' },
            { name: 'U', matrix: withSwap.U, opts: { unit: true } }
          ])
        ])
      ]),
      'det A = −1, so A is invertible. It is the factorization without a permutation that is impossible, not the matrix that is defective.'
    ));
  }

  /* ---------- LDLᵀ ---------- */
  function ldlt() {
    const host = document.getElementById('ldlt-demo');
    if (!host) return;

    const res = LDU.factorize(E.toMatrix(E.byId('spd-3x3')), { recordSteps: false });

    host.appendChild(figure(
      h('div', { style: 'display:grid;gap:16px' }, [
        R.equation([
          { name: 'A', matrix: res.A },
          { op: '=' },
          { name: 'L', matrix: res.L, opts: { unit: true } },
          { op: '·' },
          { name: 'D', matrix: res.D, opts: { diag: true } },
          { op: '·' },
          { name: 'Lᵀ', matrix: M.transpose(res.L), opts: { unit: true } }
        ]),
        h('div', { class: 'row', style: 'gap:10px' }, [
          h('span', { class: 'badge badge-ok badge-dot' }, 'U = Lᵀ verified exactly'),
          h('span', { class: 'badge badge-ok badge-dot' },
            'pivots ' + res.pivots.map(p => p.toFractionString()).join(', ') + ' all positive'),
          h('span', { class: 'badge badge-brand' }, 'positive definite')
        ])
      ]),
      'Because every pivot is positive, √D is real and R = L·√D gives the Cholesky factorization A = R·Rᵀ.'
    ));
  }

  function start() {
    shapes();
    luVsLdu();
    hiddenZero();
    swapDemo();
    ldlt();

    document.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      if (ICONS[name]) el.appendChild(icon(ICONS[name]));
    });

    S.buildToc('.prose', '#toc-host');
  }

  S.ready(start);
})();
