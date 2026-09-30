/* ============================================================
   render.js, turning exact matrices and factorization steps
   into accessible DOM. Shared by the calculator, the examples
   gallery, the applications page and the practice quiz.
   ============================================================ */
(function (global) {
  'use strict';

  const F = global.Fraction;
  const M = global.Mat;
  const S = global.Site;
  const h = S.h, icon = S.icon, ICONS = S.ICONS;

  const SUBS = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '-': '₋' };
  /** 12 → "₁₂" */
  function sub(n) { return String(n).replace(/[-\d]/g, c => SUBS[c]); }

  /** Default display options, overridable per call. */
  const defaults = { mode: 'fraction', places: 4 };

  /**
   * `round: true` gives a properly rounded decimal with no "…" marker.
   * On-screen values truncate instead, so every digit shown is a true digit;
   * exports round, so the text stays usable wherever it is pasted.
   */
  function fmt(f, opts) {
    const o = Object.assign({}, defaults, opts);
    if (!(f instanceof F)) return String(f);
    if (o.mode !== 'decimal') return f.toFractionString();
    return o.round ? f.toFixed(o.places) : f.toDecimalString(o.places);
  }

  /* ------------------------------------------------------------
     matrix(A, opts) → bracketed matrix element
     opts:
       mode, places      display format
       diag              highlight the diagonal
       unit              mark 1s on the diagonal as unit entries
       pivot             [i, j] to mark as the active pivot
       cells             { "i,j": "is-new" | "is-elim" | … }
       rows              { i: 'class' } applied to a whole row
       rails             show 1-based row / column indices
       ariaLabel         accessible name
     ------------------------------------------------------------ */
  function matrix(A, opts) {
    const o = Object.assign({}, defaults, opts || {});
    const n = M.rows(A), m = M.cols(A);

    // Pre-format so every column can be given one explicit width. With a
    // monospace font, ch units make that width exact, which is what keeps
    // the index rails aligned with the cells.
    const text = A.map(row => row.map(v => fmt(v, o)));
    let widest = 1;
    text.forEach(row => row.forEach(s => { if (s.length > widest) widest = s.length; }));
    const colWidth = `max(3.3rem, calc(${widest}ch + 20px))`;

    const body = h('div', {
      class: 'mx-body',
      style: `grid-template-columns: repeat(${m}, var(--mx-col))`
    });

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const v = A[i][j];
        const cls = ['mx-cell'];

        if (v instanceof F) {
          if (v.isZero()) cls.push('is-zero');
          else if (o.unit && i === j && v.isOne()) cls.push('is-one');
        }
        if (o.diag && i === j) cls.push('is-diag');
        if (o.pivot && o.pivot[0] === i && o.pivot[1] === j) cls.push('is-pivot');
        if (o.cells && o.cells[i + ',' + j]) cls.push(o.cells[i + ',' + j]);
        if (o.rows && o.rows[i]) cls.push(o.rows[i]);

        body.appendChild(h('span', { class: cls.join(' ') }, text[i][j]));
      }
    }

    const children = [
      h('span', { class: 'mx-bracket mx-bracket-l', 'aria-hidden': 'true' }),
      body,
      h('span', { class: 'mx-bracket mx-bracket-r', 'aria-hidden': 'true' })
    ];

    // Index rails share the grid, and therefore the tracks, with the cells.
    if (o.rails) {
      const top = h('div', { class: 'mx-rail-top', 'aria-hidden': 'true' });
      for (let j = 0; j < m; j++) top.appendChild(h('span', {}, String(j + 1)));
      const left = h('div', { class: 'mx-rail-left', 'aria-hidden': 'true' });
      for (let i = 0; i < n; i++) left.appendChild(h('span', {}, String(i + 1)));
      children.push(top, left);
    }

    const mx = h('div', {
      class : 'mx' + (o.rails ? ' has-rails' : ''),
      style: `--mx-col: ${colWidth}`
    }, children);

    if (o.ariaLabel) {
      mx.setAttribute('role', 'img');
      mx.setAttribute('aria-label', o.ariaLabel + ': ' + describeMatrixForScreenReader(A, o));
    }

    return mx;
  }

  function describeMatrixForScreenReader(A, o) {
    return A.map((row, i) => `row ${i + 1}: ` + row.map(v => fmt(v, o)).join(', ')).join('; ');
  }

  /** A matrix wrapped in a horizontal scroller, so wide matrices never break the page. */
  function scrollable(el, caption) {
    const wrap = h('div', { class: 'mx-scroll' }, el);
    if (!caption) return wrap;
    return h('div', {}, [wrap, h('div', { class: 'mx-caption' }, caption)]);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ------------------------------------------------------------
     equation([.]) → a row like  P·A = L · D · U
     Items: {name, matrix, opts} for a factor, or {op:'·'} / {op:'='}
     ------------------------------------------------------------ */
  function equation(items, opts) {
    const o = opts || {};
    const row = h('div', { class : 'mx-equation' + (o.class ? ' ' + o.class : '') });
    items.forEach(it => {
      if (it.op) {
        row.appendChild(h('span', { class: 'mx-op' }, it.op));
      } else if (it.matrix) {
        const cell = h('div', { style: 'display:grid;gap:6px;justify-items:center' }, [
          matrix(it.matrix, Object.assign({}, o, it.opts, { ariaLabel: it.name })),
          it.name ? h('span', { class : 'mx-name', style : 'font-size:1.05rem', html : it.nameHtml || escapeHtml(it.name) }) : null
        ]);
        row.appendChild(cell);
      } else if (it.text) {
        row.appendChild(h('span', { class: 'mx-name', html: it.textHtml || escapeHtml(it.text) }));
      }
    });
    return row;
  }

  /** Row of a permutation as a readable statement: "rows 1 3 2". */
  function permText(perm) {
    return perm.map(p => p + 1).join(' ');
  }

  /* ------------------------------------------------------------
     Step rendering
     ------------------------------------------------------------
     The raw step list from LDU.factorize is grouped into stages
     so the reader sees one card per elimination column plus one
     card per row of the D/U split.
     ------------------------------------------------------------ */
  function groupSteps(res) {
    const groups = [];
    let current = null;

    res.steps.forEach(st => {
      if (st.type === 'init') {
        groups.push({ kind: 'init', step: st, steps: [st] });
        current = null;
        return;
      }
      const phase = (st.type === 'split' || st.type === 'split-null') ? 'split' : 'elim';
      const key = phase + ':' + st.k;
      if (!current || current.key !== key) {
        current = { kind: phase, key, k: st.k, steps: [] };
        groups.push(current);
      }
      current.steps.push(st);
    });

    return groups;
  }

  /**
   * Renders the full step-by-step walkthrough.
   * @param {object} res  result of LDU.factorize
   * @param {object} opts { mode, places, openFirst }
   */
  function steps(res, opts) {
    const o = Object.assign({}, defaults, opts || {});
    const host = h('div', { class: 'steps' });
    const groups = groupSteps(res);
    let cardNo = 0;

    const elimGroups = groups.filter(g => g.kind === 'elim' || g.kind === 'init');
    const splitGroups = groups.filter(g => g.kind === 'split');

    host.appendChild(phaseHeader(1, 'Elimination', 'Gaussian elimination turns A into an upper-triangular Û while every multiplier is recorded in L.'));

    elimGroups.forEach(g => {
      cardNo++;
      host.appendChild(g.kind === 'init' ? initCard(g, res, o, cardNo) : elimCard(g, res, o, cardNo));
    });

    if (splitGroups.length) {
      host.appendChild(phaseHeader(2, 'Splitting Û into D · U',
        'Each row of Û is divided by its own diagonal entry. The divisors become D; what is left is a unit upper-triangular U.'));
      splitGroups.forEach(g => {
        cardNo++;
        host.appendChild(splitCard(g, res, o, cardNo));
      });
    }

    return host;
  }

  function phaseHeader(no, title, blurb) {
    return h('div', { class: 'divider-label', style: 'margin-top:8px' },
      h('span', {}, `Phase ${no}, ${title}`)
    );
  }

  function initCard(g, res, o, no) {
    const d = h('details', { class: 'step', open: true }, [
      h('summary', {}, [
        h('span', { class: 'step-num' }, String(no)),
        h('span', {}, 'Start with A')
      ]),
      h('div', { class: 'step-body' }, [
        h('p', { class: 'text-sm mt-0' },
          'The working matrix begins as A and L begins as the identity. Every entry below is exact: no rounding happens anywhere in this process.'),
        scrollable(matrix(g.step.matrix, Object.assign({}, o, { rails: true, ariaLabel: 'Matrix A' })))
      ])
    ]);
    return d;
  }

  function elimCard(g, res, o, no) {
    const k = g.k;
    const swap = g.steps.find(s => s.type === 'swap');
    const pivotStep = g.steps.find(s => s.type === 'pivot');
    const nullCol = g.steps.find(s => s.type === 'null-column');
    const elims = g.steps.filter(s => s.type === 'eliminate');
    const skips = g.steps.filter(s => s.type === 'skip');
    const last = g.steps[g.steps.length - 1];

    const body = h('div', { class: 'step-body' });

    /* --- row swap --- */
    if (swap) {
      body.appendChild(h('div', { class: 'alert alert-warn' }, [
        icon(ICONS.refresh),
        h('div', {}, [
          h('span', { class: 'alert-title' }, `Row swap: R${sub(swap.rowA + 1)} ↔ R${sub(swap.rowB + 1)}`),
          h('p', {}, swap.reason === 'zero-pivot'
            ? `The natural pivot a${sub(k + 1)}${sub(k + 1)} is zero, so it cannot divide anything. Row ${swap.rowB + 1} has a non-zero entry in column ${k + 1}, so the two rows trade places. This swap is recorded in the permutation matrix P; it is why the result reads P·A = L·D·U rather than A = L·D·U.`
            : `Partial pivoting picks the largest entry in column ${k + 1} as the pivot, which is in row ${swap.rowB + 1}.`),
          h('p', { class: 'text-xs', style: 'margin-top:6px' },
            'Multipliers already stored in columns 1…' + k + ' of L move with their rows.')
        ])
      ]));
    }

    /* --- a column with no available pivot --- */
    if (nullCol) {
      body.appendChild(h('div', { class: 'alert alert-err' }, [
        icon(ICONS.alert),
        h('div', {}, [
          h('span', { class: 'alert-title' }, `Column ${k + 1} has no usable pivot`),
          h('p', {}, `Every entry of column ${k + 1} from row ${k + 1} downwards is zero, so no row swap can supply a pivot. There is nothing to eliminate, and d${sub(k + 1)} will be 0; a sign that A is singular.`)
        ])
      ]));
    }

    /* --- the pivot --- */
    if (pivotStep) {
      body.appendChild(h('div', {}, [
        h('div', { class: 'step-tag' }, 'Pivot'),
        h('div', { class: 'formula' },
          `a${sub(k + 1)}${sub(k + 1)} = ${fmt(pivotStep.pivot, o)}   →   d${sub(k + 1)} = ${fmt(pivotStep.pivot, o)}`)
      ]));
    }

    /* --- the multipliers and row operations --- */
    if (elims.length || skips.length) {
      const list = h('div', { class: 'formula-list' });

      elims.forEach(st => {
        list.appendChild(h('div', { class: 'formula' },
          `ℓ${sub(st.i + 1)}${sub(k + 1)} = a${sub(st.i + 1)}${sub(k + 1)} ÷ a${sub(k + 1)}${sub(k + 1)} = ` +
          `${fmt(st.aik, o)} ÷ ${fmt(st.pivot, o)} = ${fmt(st.m, o)}`));

        // Write a negative multiplier as an addition rather than
        // printing a double negative like "− (−3) ·".
        const neg = st.m.isNegative();
        const shown = fmt(neg ? st.m.neg() : st.m, o);
        list.appendChild(h('div', { class: 'formula formula-ok' },
          `R${sub(st.i + 1)} ← R${sub(st.i + 1)} ${neg ? '+' : '−'} ${shown} · R${sub(k + 1)}`));
      });

      skips.forEach(st => {
        list.appendChild(h('div', { class: 'formula' },
          `a${sub(st.i + 1)}${sub(k + 1)} is already 0  →  ℓ${sub(st.i + 1)}${sub(k + 1)} = 0, row ${st.i + 1} is left alone`));
      });

      body.appendChild(h('div', {}, [
        h('div', { class : 'step-tag' }, elims.length ? 'Multipliers and row operations' : 'Nothing to eliminate'),
        list
      ]));
    }

    /* --- resulting matrices --- */
    const cells = {};
    elims.forEach(st => {
      for (let j = k; j < res.n; j++) cells[st.i + ',' + j] = j === k ? 'is-elim' : 'is-new';
    });

    const grid = h('div', { class: 'row', style: 'gap:24px;align-items:flex-start' }, [
      h('div', {}, [
        h('div', { class: 'step-tag', style: 'margin-bottom:6px' }, 'Working matrix'),
        scrollable(matrix(last.matrix, Object.assign({}, o, {
          pivot : pivotStep ? [k, k] : null, cells, rails : true, ariaLabel : 'Working matrix'
        })))
      ]),
      h('div', {}, [
        h('div', { class: 'step-tag', style: 'margin-bottom:6px' }, 'L so far'),
        scrollable(matrix(last.L, Object.assign({}, o, { unit: true, ariaLabel: 'Matrix L' })))
      ])
    ]);
    body.appendChild(grid);

    const title = swap
      ? `Stage ${k + 1}, swap rows, then eliminate column ${k + 1}`
      : nullCol
        ? `Stage ${k + 1}, column ${k + 1} is empty below the diagonal`
        : elims.length
          ? `Stage ${k + 1}, clear column ${k + 1} below the pivot`
          : `Stage ${k + 1}, column ${k + 1} is already clear`;

    return h('details', { class : 'step' + (swap ? ' step-swap' : '') }, [
      h('summary', {}, [
        h('span', { class: 'step-num' }, String(no)),
        h('span', {}, title),
        pivotStep ? h('span', { class : 'badge badge-brand nowrap' }, `d${sub(k + 1)} = ${fmt(pivotStep.pivot, o)}`) : null
      ]),
      body
    ]);
  }

  function splitCard(g, res, o, no) {
    const k = g.k;
    const st = g.steps[0];
    const body = h('div', { class: 'step-body' });

    if (st.type === 'split') {
      body.appendChild(h('div', { class: 'formula-list' }, [
        h('div', { class: 'formula' }, `d${sub(k + 1)} = û${sub(k + 1)}${sub(k + 1)} = ${fmt(st.d, o)}`),
        h('div', { class: 'formula formula-ok' },
          `row ${k + 1} of U = ( row ${k + 1} of Û ) ÷ ${fmt(st.d, o)}`)
      ]));

      const rowCells = st.rowUhat.map((v, j) => [v]);
      body.appendChild(h('div', { class: 'row', style: 'gap:20px;align-items:center;flex-wrap:wrap' }, [
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:6px' }, `Row ${k + 1} of Û`),
          scrollable(matrix([st.rowUhat], o))
        ]),
        h('span', { class: 'mx-op' }, `÷ ${fmt(st.d, o)}`),
        h('span', { class: 'mx-op' }, '='),
        h('div', {}, [
          h('div', { class: 'step-tag', style: 'margin-bottom:6px' }, `Row ${k + 1} of U`),
          scrollable(matrix([st.rowU], Object.assign({}, o, { cells: { ['0,' + k]: 'is-one' } })))
        ])
      ]));

      body.appendChild(h('p', { class: 'text-sm' },
        `Dividing by the diagonal entry puts a 1 in position ${k + 1},${k + 1}, which is exactly what makes U unit upper triangular.`));
    } else {
      // d_k = 0
      body.appendChild(h('div', { class : 'alert ' + (st.rowIsZero ? 'alert-warn' : 'alert-err') }, [
        icon(st.rowIsZero ? ICONS.info : ICONS.alert),
        h('div', {}, [
          h('span', { class: 'alert-title' }, `d${sub(k + 1)} = 0, cannot divide row ${k + 1}`),
          st.rowIsZero
            ? h('p', {}, `Row ${k + 1} of Û is entirely zero, so row ${k + 1} of D·U is zero no matter what U contains. The unit-triangular convention fills the row with e${sub(k + 1)}, and the identity still holds, but U is no longer unique.`)
            : h('p', {}, `Row ${k + 1} of Û is not zero, yet d${sub(k + 1)} = 0 forces row ${k + 1} of D·U to be zero. The two cannot agree, so this matrix has no LDU factorization with unit-triangular factors.`)
        ])
      ]));
    }

    return h('details', { class: 'step' }, [
      h('summary', {}, [
        h('span', { class: 'step-num' }, String(no)),
        h('span', {}, `Normalise row ${k + 1}`),
        st.type === 'split'
          ? h('span', { class : 'badge badge-brand nowrap' }, `÷ ${fmt(st.d, o)}`)
          : h('span', { class: 'badge badge-err nowrap' }, `d${sub(k + 1)} = 0`)
      ]),
      body
    ]);
  }

  /* ------------------------------------------------------------
     Substitution steps for solving A·x = b
     ------------------------------------------------------------ */
  function solveSteps(sol, res, opts) {
    const o = Object.assign({}, defaults, opts || {});
    const host = h('div', { class: 'stack' });

    const pass = (title, blurb, lines) => h('div', { class: 'panel' }, [
      h('h4', { style: 'margin-bottom:4px' }, title),
      h('p', { class: 'text-sm', style: 'margin-bottom:10px' }, blurb),
      h('div', { class: 'formula-list' }, lines)
    ]);

    /* forward: L y = Pb */
    host.appendChild(pass(
      '1. Forward substitution, solve L·y = P·b',
      'L is unit lower triangular, so each yᵢ follows from the ones above it with no division at all.',
      sol.steps.forward.map(s => {
        const rhs = s.terms.length
          ? `${fmt(s.rhs, o)} − ` + s.terms.map(t => `(${fmt(t.l, o)})·${fmt(t.y, o)}`).join(' − ')
          : fmt(s.rhs, o);
        return h('div', { class: 'formula' }, `y${sub(s.i + 1)} = ${rhs} = ${fmt(s.value, o)}`);
      })
    ));

    /* diagonal: D z = y */
    host.appendChild(pass(
      '2. Diagonal solve, solve D·z = y',
      'D is diagonal, so this is one division per entry.',
      sol.steps.diagonal.map(s => h('div', {
        class : 'formula' + (s.conflict ? ' formula-warn' : '')
      }, s.conflict
        ? `0 · z${sub(s.i + 1)} = ${fmt(s.y, o)}  →  impossible, the system is inconsistent`
        : s.free
          ? `0 · z${sub(s.i + 1)} = 0  →  z${sub(s.i + 1)} is free; take z${sub(s.i + 1)} = 0`
          : `z${sub(s.i + 1)} = y${sub(s.i + 1)} ÷ d${sub(s.i + 1)} = ${fmt(s.y, o)} ÷ ${fmt(s.d, o)} = ${fmt(s.value, o)}`))
    ));

    if (sol.kind === 'inconsistent') return host;

    /* back: U x = z */
    host.appendChild(pass(
      '3. Back substitution, solve U·x = z',
      'U is unit upper triangular, so work upwards from the last row, again with no division.',
      sol.steps.back.map(s => {
        const rhs = s.terms.length
          ? `${fmt(s.rhs, o)} − ` + s.terms.map(t => `(${fmt(t.u, o)})·${fmt(t.x, o)}`).join(' − ')
          : fmt(s.rhs, o);
        return h('div', { class: 'formula' }, `x${sub(s.i + 1)} = ${rhs} = ${fmt(s.value, o)}`);
      })
    ));

    return host;
  }

  /* ------------------------------------------------------------
     Export helpers
     ------------------------------------------------------------ */
  function resultToPlainText(res, o) {
    const opt = Object.assign({}, defaults, o || {});
    const L = ['DecomposeX: LDU factorization', ''];
    L.push('A =', M.toText(res.A, opt), '');
    if (res.needsPermutation) {
      L.push('Row permutation (P·A takes A rows in this order): ' + permText(res.perm), '');
      L.push('P =', M.toText(res.P, opt), '');
    }
    L.push('L =', M.toText(res.L, opt), '');
    L.push('D =', M.toText(res.D, opt), '');
    L.push('U =', M.toText(res.U, opt), '');
    L.push('Û = D·U (the eliminated matrix) =', M.toText(res.Uhat, opt), '');
    L.push('Identity : ' + (res.needsPermutation ? 'P·A = L·D·U' : 'A = L·D·U'));
    L.push('Verified exactly : ' + (res.verification.matches ? 'yes' : 'NO'));
    L.push('det A = ' + fmt(res.det, opt));
    L.push('rank A = ' + res.rank + ' of ' + res.n);
    L.push('Leading principal minors: ' + res.minors.map(m => fmt(m, opt)).join(', '));
    if (res.isLDLt) L.push('Symmetric : U = Lᵀ, so A = L·D·Lᵀ' + (res.isSPD ? ' and A is positive definite.' : '.'));
    res.messages.forEach(m => L.push('[' + m.level + '] ' + m.text));
    return L.join('\n');
  }

  function resultToLatex(res) {
    const lines = [];
    lines.push('% DecomposeX: LDU factorization');
    lines.push('A = ' + M.toLatex(res.A));
    lines.push('');
    if (res.needsPermutation) { lines.push('P = ' + M.toLatex(res.P)); lines.push(''); }
    lines.push((res.needsPermutation ? 'P A' : 'A') + ' = L D U =');
    lines.push(M.toLatex(res.L));
    lines.push(M.toLatex(res.D));
    lines.push(M.toLatex(res.U));
    return lines.join('\n');
  }

  global.Render = {
    sub, fmt, defaults,
    matrix, equation, scrollable, permText,
    groupSteps, steps, solveSteps,
    resultToPlainText, resultToLatex,
    escapeHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
