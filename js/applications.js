/* ============================================================
   applications.js, live demonstrations for the Applications page
   ============================================================ */
(function () {
  'use strict';

  const F = window.Fraction, M = window.Mat, LDU = window.LDU;
  const S = window.Site, R = window.Render, E = window.ExampleData;
  const h = S.h, icon = S.icon, ICONS = S.ICONS, clear = S.clear;

  function figure(content, caption) {
    return h('figure', { class: 'panel', style: 'margin:20px 0;display:grid;gap:12px' }, [
      h('div', { class: 'mx-scroll' }, content),
      caption ? h('figcaption', { class : 'text-sm text-mute' }, caption) : null
    ]);
  }

  /* ============================================================
     1. Interactive solver
     ============================================================ */
  function solverDemo() {
    const host = document.getElementById('solver-demo');
    if (!host) return;

    const systems = E.EXAMPLES.filter(e => e.b);
    const st = { exId: systems[0].id, b: systems[0].b.slice(), res: null };

    const select = h('select', { class: 'select', id: 'sys-select', style: 'max-width:340px' },
      systems.map(e => h('option', { value: e.id }, e.title + '  (' + e.rows.length + '×' + e.rows.length + ')')));

    const bHost = h('div', { class: 'mx-scroll' });
    const out = h('div', { style: 'display:grid;gap:18px' });

    function factorize() {
      const ex = E.byId(st.exId);
      st.res = LDU.factorize(E.toMatrix(ex), { recordSteps: false });
    }

    function buildB() {
      clear(bHost);
      const body = h('div', { class: 'mx-input-body', style: 'grid-template-columns: minmax(48px,72px)' });
      st.b.forEach((v, i) => {
        const inp = h('input', {
          class: 'mx-in', type: 'text', value: v, spellcheck: 'false',
          'aria-label': 'b entry ' + (i + 1)
        });
        inp.addEventListener('input', () => {
          st.b[i] = inp.value;
          const ok = inp.value.trim() === '' || F.parse(inp.value) !== null;
          inp.classList.toggle('invalid', !ok);
          render();
        });
        body.appendChild(inp);
      });
      bHost.appendChild(h('div', { class: 'mx' }, [
        h('span', { class: 'mx-bracket mx-bracket-l' }), body, h('span', { class: 'mx-bracket mx-bracket-r' })
      ]));
    }

    function render() {
      clear(out);
      const res = st.res;

      const bad = st.b.some(v => v.trim() !== '' && F.parse(v) === null);
      if (bad) {
        out.appendChild(h('div', { class: 'alert alert-err' }, [
          icon(ICONS.alert),
          h('div', {}, h('p', {}, 'One of the entries of b is not a number. Use integers, decimals or fractions.'))
        ]));
        return;
      }

      const bVec = st.b.map(v => (v.trim() === '' ? F.ZERO : F.from(v)));
      let sol;
      try { sol = LDU.solve(res, bVec); } catch (e) { return; }

      const badge = {
        'unique': ['badge-ok', 'exactly one solution'],
        'singular-consistent': ['badge-warn', 'infinitely many solutions'],
        'inconsistent': ['badge-err', 'no solution'],
        'unavailable': ['badge-err', 'not solvable this way']
      }[sol.kind];

      out.appendChild(h('div', { class: 'row', style: 'gap:8px' }, [
        h('span', { class: 'badge ' + badge[0] + ' badge-dot' }, badge[1]),
        res.needsPermutation ? h('span', { class : 'badge badge-info badge-dot' }, 'P·A = L·D·U, so b is permuted') : null,
        sol.x && sol.residualOk ? h('span', { class : 'badge badge-ok badge-dot' }, 'A·x = b re-checked exactly') : null
      ]));

      if (sol.x) {
        out.appendChild(R.equation([
          { name: 'A', matrix: res.A },
          { op: '·' },
          { name: 'x', matrix: sol.x.map(v => [v]) },
          { op: '=' },
          { name: 'b', matrix: bVec.map(v => [v]) }
        ]));
        out.appendChild(h('div', { class: 'formula' },
          'x = ( ' + sol.x.map(v => v.toFractionString()).join(',  ') + ' )'));
      } else {
        out.appendChild(h('p', { class: 'text-sm' }, sol.message));
      }

      out.appendChild(h('details', { open: true }, [
        h('summary', { style: 'cursor:pointer;font-weight:600;color:var(--primary);font-size:.9rem' },
          'The three passes in full'),
        h('div', { style: 'padding-top:14px' }, R.solveSteps(sol, res))
      ]));
    }

    function reload() {
      const ex = E.byId(st.exId);
      st.b = ex.b.slice();
      factorize();
      buildB();
      render();
    }

    select.addEventListener('change', () => { st.exId = select.value; reload(); });

    const randomBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, [icon(ICONS.dice), 'Random b']);
    randomBtn.addEventListener('click', () => {
      st.b = st.b.map(() => String(M.randInt(-9, 9)));
      buildB();
      render();
    });

    const calcLink = h('a', { class: 'btn btn-ghost btn-sm', href: '#' }, 'Open in calculator');
    select.addEventListener('change', () => {
      const ex = E.byId(st.exId);
      calcLink.href = 'calculator.html#m=' + encodeURIComponent(ex.rows.map(r => r.join(',')).join(';')) +
        '&b=' + encodeURIComponent(st.b.join(','));
    });

    host.appendChild(h('div', { class: 'card', style: 'margin:20px 0' }, [
      h('div', { class: 'row', style: 'margin-bottom:18px' }, [
        h('label', { class: 'label', for: 'sys-select', style: 'margin:0' }, 'System'),
        select,
        h('span', { class: 'spacer' }),
        randomBtn
      ]),
      h('div', { class: 'row', style: 'gap:24px;align-items:flex-start;margin-bottom:20px' }, [
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:6px' }, 'Right-hand side b'),
          bHost
        ])
      ]),
      out
    ]));

    reload();
  }

  /* ============================================================
     2. Determinant from the pivots
     ============================================================ */
  function detDemo() {
    const host = document.getElementById('det-demo');
    if (!host) return;

    const ids = ['classic-3x3', 'swap-3x3', 'singular-rank1'];
    const rows = ids.map(id => {
      const ex = E.byId(id);
      const res = LDU.factorize(E.toMatrix(ex), { recordSteps: false });
      const prod = res.pivots.reduce((a, b) => a.mul(b), F.ONE);
      const signed = res.swapCount % 2 ? prod.neg() : prod;
      return h('tr', {}, [
        h('td', {}, h('strong', {}, ex.title)),
        h('td', { class: 'num' }, res.pivots.map(p => p.toFractionString()).join(' · ')),
        h('td', { class: 'num' }, String(res.swapCount)),
        h('td', { class : 'num' }, (res.swapCount % 2 ? '−1 · ' : '') + prod.toFractionString()),
        h('td', { class: 'num' }, h('strong', {}, res.det.toFractionString())),
        h('td', {}, signed.eq(res.det)
          ? h('span', { class : 'badge badge-ok badge-dot' }, 'agrees')
          : h('span', { class: 'badge badge-err badge-dot' }, 'mismatch'))
      ]);
    });

    host.appendChild(figure(
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, [
        h('thead', {}, h('tr', {}, [
          h('th', {}, 'Matrix'), h('th', { class: 'num' }, 'pivots'), h('th', { class: 'num' }, 'swaps s'),
          h('th', { class: 'num' }, '(−1)ˢ · ∏dₖ'), h('th', { class: 'num' }, 'det A'), h('th', {}, '')
        ])),
        h('tbody', {}, rows)
      ])),
      'The last column compares the pivot product against a determinant computed independently. The third row is singular, and a single zero pivot is enough to make the whole product vanish.'
    ));
  }

  /* ============================================================
     3. Inverse
     ============================================================ */
  function invDemo() {
    const host = document.getElementById('inv-demo');
    if (!host) return;

    const res = LDU.factorize(E.toMatrix(E.byId('classic-3x3')), { recordSteps: false });
    const inv = LDU.inverse(res);
    if (!inv.ok) return;

    host.appendChild(figure(
      h('div', { style: 'display:grid;gap:16px' }, [
        R.equation([
          { name: 'A', matrix: res.A },
          { op: '·' },
          { name: 'A⁻¹', matrix: inv.matrix },
          { op: '=' },
          { name: 'I', matrix: M.mul(res.A, inv.matrix), opts: { unit: true } }
        ]),
        h('div', { class: 'row', style: 'gap:8px' }, [
          h('span', { class: 'badge badge-ok badge-dot' }, 'verified exactly'),
          h('span', { class: 'badge' }, '3 substitution pairs, one factorization')
        ])
      ]),
      'Each column of A⁻¹ came from solving A·xⱼ = eⱼ with the same L, D and U. Notice the fractions: the inverse of an integer matrix is integral only when det A = ±1.'
    ));
  }

  /* ============================================================
     4. Consistency: one singular matrix, three right-hand sides
     ============================================================ */
  function consistencyDemo() {
    const host = document.getElementById('consistency-demo');
    if (!host) return;

    const A = M.from([['1', '2'], ['2', '4']]);
    const res = LDU.factorize(A, { recordSteps: false });

    const cases = [
      { b: ['1', '2'], label: 'consistent' },
      { b: ['1', '3'], label: 'inconsistent' },
      { b: ['0', '0'], label: 'homogeneous' }
    ];

    const cards = cases.map(c => {
      const bVec = c.b.map(v => F.from(v));
      const sol = LDU.solve(res, bVec);
      const badge = {
        'unique': ['badge-ok', 'unique solution'],
        'singular-consistent': ['badge-warn', 'infinitely many'],
        'inconsistent': ['badge-err', 'no solution']
      }[sol.kind];

      return h('div', { class: 'card card-sm' }, [
        h('div', { class: 'row', style: 'gap:10px;align-items:center;margin-bottom:12px' }, [
          h('span', { class: 'mx-name', style: 'font-size:1rem' }, 'b'),
          h('span', { class: 'mx-eq' }, '='),
          R.matrix(bVec.map(v => [v]))
        ]),
        h('span', { class: 'badge ' + badge[0] + ' badge-dot' }, badge[1]),
        h('p', { class: 'text-sm', style: 'margin-top:12px' }, sol.message),
        sol.x
          ? h('div', { class : 'formula', style : 'margin-top:10px' },
            'x = ( ' + sol.x.map(v => v.toFractionString()).join(', ') + ' )')
              : h('div', { class: 'formula formula-warn', style: 'margin-top:10px' },
            '0 · z₂ = ' + sol.steps.diagonal[1].y.toFractionString() + '  →  impossible')
      ]);
    });

    host.appendChild(figure(
      h('div', { style: 'display:grid;gap:16px' }, [
        h('div', { class: 'row', style: 'gap:12px;align-items:center' }, [
          h('span', { class: 'mx-name' }, 'A'),
          h('span', { class: 'mx-eq' }, '='),
          R.matrix(A),
          h('span', { class: 'badge badge-warn badge-dot' }, 'singular, rank 1'),
          h('span', { class: 'badge' }, 'D = diag(1, 0)')
        ]),
        h('div', { class: 'grid grid-3' }, cards)
      ]),
      'The same factorization answers all three. Because d₂ = 0, the second equation after forward substitution reads 0 = y₂, satisfiable only when y₂ happens to be zero.'
    ));
  }

  /* ============================================================
     5. Definiteness from pivot signs
     ============================================================ */
  function definiteDemo() {
    const host = document.getElementById('definite-demo');
    if (!host) return;

    const cases = [
      { rows: [['4', '2', '2'], ['2', '5', '3'], ['2', '3', '6']], expect: 'Positive definite' },
      { rows: [['-4', '-2', '-2'], ['-2', '-5', '-3'], ['-2', '-3', '-6']], expect: 'Negative definite' },
      { rows: [['1', '2'], ['2', '1']], expect: 'Indefinite' },
      { rows: [['1', '1'], ['1', '1']], expect: 'Positive semi-definite' }
    ];

    const rows = cases.map(c => {
      const A = M.from(c.rows);
      const res = LDU.factorize(A, { recordSteps: false });
      const ds = Array.from({ length: res.n }, (_, i) => res.D[i][i]);
      const pos = ds.filter(d => d.isPositive()).length;
      const neg = ds.filter(d => d.isNegative()).length;
      const zero = ds.filter(d => d.isZero()).length;

      // Classify from the signature, then compare with the expected label.
      let verdict;
      if (zero === 0 && neg === 0) verdict = 'Positive definite';
      else if (zero === 0 && pos === 0) verdict = 'Negative definite';
      else if (pos > 0 && neg > 0) verdict = 'Indefinite';
      else if (neg === 0) verdict = 'Positive semi-definite';
      else verdict = 'Negative semi-definite';

      const cls = verdict.indexOf('Indefinite') === 0 ? 'badge-warn'
                                                      : verdict.indexOf('semi') !== -1 ? 'badge-info' : 'badge-ok';

      return h('tr', {}, [
        h('td', {}, h('div', { class: 'mx-scroll' }, R.matrix(A))),
        h('td', { class: 'num' }, ds.map(d => d.toFractionString()).join(', ')),
        h('td', { class: 'num' }, `${pos}+ ${neg}− ${zero}0`),
        h('td', {}, h('span', { class: 'badge ' + cls + ' badge-dot' }, verdict)),
        h('td', {}, verdict === c.expect
          ? h('span', { class : 'badge badge-ok badge-dot' }, 'as expected')
          : h('span', { class: 'badge badge-err badge-dot' }, 'expected ' + c.expect))
      ]);
    });

    host.appendChild(figure(
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, [
        h('thead', {}, h('tr', {}, [
          h('th', {}, 'Symmetric A'), h('th', { class: 'num' }, 'pivots dₖ'),
          h('th', { class: 'num' }, 'signature'), h('th', {}, 'classification'), h('th', {}, '')
        ])),
        h('tbody', {}, rows)
      ])),
      'One factorization per row; no eigenvalues computed. The second matrix is the negative of the first, which flips every pivot sign, exactly as the theory predicts.'
    ));
  }

  /* ============================================================
     6. LDLᵀ → Cholesky
     ============================================================ */
  function choleskyDemo() {
    const host = document.getElementById('cholesky-demo');
    if (!host) return;

    const res = LDU.factorize(E.toMatrix(E.byId('spd-3x3')), { recordSteps: false });
    const ch = LDU.choleskyFromLDL(res);
    if (!ch.ok) return;

    const fx = x => {
      if (x === 0) return '0';
      const s = x.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      return s === '-0' ? '0' : s;
    };

    const floatMx = rows => {
      const n = rows.length;
      const body = h('div', { class: 'mx-body', style: `grid-template-columns: repeat(${n}, auto)` });
      rows.forEach(r => r.forEach(x =>
        body.appendChild(h('span', { class : 'mx-cell' + (x === 0 ? ' is-zero' : '') }, fx(x)))));
      return h('div', { class: 'mx' }, [
        h('span', { class: 'mx-bracket mx-bracket-l' }), body, h('span', { class: 'mx-bracket mx-bracket-r' })
      ]);
    };

    host.appendChild(figure(
      h('div', { style: 'display:grid;gap:20px' }, [
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'Exact: LDLᵀ'),
          R.equation([
            { name: 'A', matrix: res.A },
            { op: '=' },
            { name: 'L', matrix: res.L, opts: { unit: true } },
            { op: '·' },
            { name: 'D', matrix: res.D, opts: { diag: true } },
            { op: '·' },
            { name: 'Lᵀ', matrix: M.transpose(res.L), opts: { unit: true } }
          ])
        ]),
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:8px' }, 'Approximate: Cholesky, R = L·√D'),
          h('div', { class: 'mx-equation' }, [
            h('div', { style: 'display:grid;gap:6px;justify-items:center' }, [
              floatMx(ch.R), h('span', { class: 'mx-name', style: 'font-size:1.05rem' }, 'R')
            ]),
            h('span', { class: 'mx-op' }, '·'),
            h('div', { style: 'display:grid;gap:6px;justify-items:center' }, [
              floatMx(ch.R[0].map((_, j) => ch.R.map(r => r[j]))),
              h('span', { class: 'mx-name', style: 'font-size:1.05rem' }, 'Rᵀ')
            ]),
            h('span', { class: 'mx-op' }, '='),
            h('div', { style: 'display:grid;gap:6px;justify-items:center' }, [
              R.matrix(res.A), h('span', { class: 'mx-name', style: 'font-size:1.05rem' }, 'A')
            ])
          ])
        ]),
        h('div', { class: 'formula' }, '√dₖ = ' + ch.sqrtD.map(fx).join(',  '))
      ]),
      'Here every pivot happens to be 4, so the square roots are exact integers. For most positive-definite matrices they are irrational, which is why the LDLᵀ form is the one that stays exact.'
    ));
  }

  function start() {
    solverDemo();
    detDemo();
    invDemo();
    consistencyDemo();
    definiteDemo();
    choleskyDemo();

    document.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      if (ICONS[name]) el.appendChild(icon(ICONS[name]));
    });

    S.buildToc('.prose', '#toc-host');
  }

  S.ready(start);
})();
