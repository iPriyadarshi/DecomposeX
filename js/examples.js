/* ============================================================
   examples.js: the worked-examples gallery
   Every card is factored at page load by the real algorithm.
   ============================================================ */
(function () {
  'use strict';

  const F = window.Fraction, M = window.Mat, LDU = window.LDU;
  const S = window.Site, R = window.Render, E = window.ExampleData;
  const h = S.h, icon = S.icon, ICONS = S.ICONS, clear = S.clear;

  const state = { mode: 'fraction', filter: '' };
  function opts() { return { mode: state.mode, places: 4 }; }

  /**
   * A link that opens this matrix in the calculator.
   * @param {object} ex        the example
   * @param {boolean} withRhs  also preload its right-hand side b, which
   *                           switches the calculator into solving mode.
   *                           Without this the two buttons on a card would
   *                           point at the same URL.
   */
  function calcHref(ex, withRhs) {
    const m = ex.rows.map(r => r.join(',')).join(';');
    let href = 'calculator.html#m=' + encodeURIComponent(m);
    if (withRhs && ex.b) href += '&b=' + encodeURIComponent(ex.b.join(','));
    return href;
  }

  /** Short status chips describing what happened. */
  function chips(res) {
    const out = [];

    if (res.status === 'no-ldu') out.push(h('span', { class: 'badge badge-err badge-dot' }, 'no LDU exists'));
    else if (res.needsPermutation) out.push(h('span', { class: 'badge badge-info badge-dot' }, 'needs P'));
    else out.push(h('span', { class: 'badge badge-ok badge-dot' }, 'A = L·D·U'));

    out.push(h('span', { class: 'badge' }, 'det = ' + R.fmt(res.det, opts())));
    out.push(h('span', { class: 'badge' }, 'rank ' + res.rank + '/' + res.n));

    if (res.isSingular) out.push(h('span', { class: 'badge badge-warn badge-dot' }, 'singular'));
    if (res.isSPD) out.push(h('span', { class: 'badge badge-brand' }, 'positive definite'));
    else if (res.isLDLt) out.push(h('span', { class: 'badge badge-brand' }, 'A = L·D·Lᵀ'));

    if (res.swapCount) out.push(h('span', { class : 'badge' }, res.swapCount + ' swap' + (res.swapCount === 1 ? '' : 's')));
    return out;
  }

  function exampleCard(ex) {
    const A = E.toMatrix(ex);
    const res = LDU.factorize(A);
    const o = opts();

    /* the identity, or the LU fallback when there is no LDU */
    let equation;
    if (res.status === 'no-ldu') {
      equation = h('div', { style: 'display:grid;gap:12px' }, [
        h('div', { class: 'alert alert-err' }, [
          icon(ICONS.x),
          h('div', {}, [
            h('span', { class: 'alert-title' }, 'No LDU factorization'),
            h('p', {}, 'The LU form still holds, and is shown instead.')
          ])
        ]),
        R.equation([
          { name: 'A', matrix: res.A },
          { op: '=' },
          { name: 'L', matrix: res.L, opts: { unit: true } },
          { op: '·' },
          { name: 'Û', matrix: res.Uhat, opts: { diag: true } }
        ], o)
      ]);
    } else {
      const items = [];
      if (res.needsPermutation) { items.push({ name: 'P', matrix: res.P }); items.push({ op: '·' }); }
      items.push({ name: 'A', matrix: res.A });
      items.push({ op: '=' });
      items.push({ name: 'L', matrix: res.L, opts: { unit: true } });
      items.push({ op: '·' });
      items.push({ name: 'D', matrix: res.D, opts: { diag: true } });
      items.push({ op: '·' });
      items.push({ name : res.isLDLt ? 'Lᵀ' : 'U', matrix : res.U, opts: { unit : true } });
      equation = R.equation(items, o);
    }

    /* pivot / minor line */
    const pivotLine = h('div', { class: 'formula-list' }, [
      h('div', { class: 'formula' },
        'pivots  d = ' + res.pivots.map(p => R.fmt(p, o)).join(',  ')),
      h('div', { class: 'formula' },
        'leading minors  D = ' + res.minors.map(p => R.fmt(p, o)).join(',  '))
    ]);

    /* verification chip */
    const verified = res.status === 'no-ldu'
      ? LDU.verifyLU(res).matches
      : res.verification.matches;

    const card = h('article', {
      class: 'card ex-card',
      'data-tags': ex.tags.join('|').toLowerCase(),
      id: 'ex-' + ex.id
    }, [
      h('div', { class: 'card-head', style: 'margin-bottom:8px' }, [
        h('h3', { style: 'margin:0;font-size:1.08rem' }, ex.title),
        h('span', { class: 'spacer' }),
        h('span', { class : 'badge ' + (verified ? 'badge-ok' : 'badge-err') + ' badge-dot' },
          verified ? 'verified' : 'failed')
      ]),
      h('p', { class: 'text-sm', style: 'margin:0 0 4px' }, ex.blurb),
      h('div', { class: 'row', style: 'gap:6px;margin:10px 0 16px' }, chips(res)),

      h('div', { class: 'mx-scroll' }, equation),

      h('details', { style: 'margin-top:16px' }, [
        h('summary', { style: 'cursor:pointer;font-size:.9rem;font-weight:600;color:var(--primary)' },
          'What to notice'),
        h('div', { style: 'padding-top:12px;display:grid;gap:14px' }, [
          h('p', { class: 'text-sm', style: 'margin:0' }, ex.note),
          pivotLine,
          res.messages.length
            ? h('div', { style : 'display:grid;gap:8px' }, res.messages.map(m =>
              h('div', {
                class : 'alert ' + (m.level === 'error' ? 'alert-err' : m.level === 'warn' ? 'alert-warn' : 'alert-info')
              }, [
                icon(ICONS[m.level === 'error' ? 'x' : m.level === 'warn' ? 'alert' : 'lightbulb']),
                h('div', {}, h('p', {}, m.text))
              ])))
                : null
        ])
      ]),

      h('div', { class: 'row', style: 'margin-top:18px' }, [
        h('a', { class: 'btn btn-soft btn-sm', href: calcHref(ex, false) },
          [icon(ICONS.calc), 'Factor this matrix']),
        ex.b
          ? h('a', {
            class: 'btn btn-ghost btn-sm',
            href: calcHref(ex, true),
            title: 'Opens the calculator with b = (' + ex.b.join(', ') + ') already filled in'
          }, [icon(ICONS.target), 'Solve A·x = b'])
            : null,
        h('span', { class: 'spacer' }),
        h('div', { class: 'ex-tags' }, ex.tags.map(t => h('span', { class: 'badge' }, t)))
      ])
    ]);

    return card;
  }

  function build() {
    const host = document.getElementById('groups-host');
    clear(host);

    let shown = 0, total = 0;

    E.GROUPS.forEach(g => {
      const list = E.byGroup(g.id);
      const cards = [];

      list.forEach(ex => {
        total++;
        if (state.filter && ex.tags.map(t => t.toLowerCase()).indexOf(state.filter) === -1) return;
        shown++;
        cards.push(exampleCard(ex));
      });

      if (!cards.length) return;

      const section = h('section', { class: 'section', id: g.id, style: 'margin-top:44px' }, [
        h('div', { class: 'section-head' }, [
          h('h2', { style: 'font-size:1.45rem' }, g.title),
          h('p', {}, g.blurb)
        ]),
        h('div', { class: 'grid grid-2' }, cards)
      ]);
      host.appendChild(section);
    });

    const hint = document.getElementById('count-hint');
    if (hint) {
      hint.textContent = state.filter
        ? `Showing ${shown} of ${total} examples tagged “${state.filter}”.`
        : `${total} examples, all factored on this page.`;
    }

    if (!shown) {
      host.appendChild(h('div', { class: 'results-empty' }, [
        h('div', {}, [
          h('h3', {}, 'Nothing matches that tag'),
          h('p', { class: 'text-sm', style: 'margin-top:6px' }, 'Clear the filter to see every example.')
        ])
      ]));
    }

    // Jump to a hash target once the cards exist.
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) el.scrollIntoView({ block: 'start' });
    }
  }

  function buildFilter() {
    const sel = document.getElementById('filter-select');
    clear(sel);
    sel.appendChild(h('option', { value: '' }, 'All examples'));
    E.allTags().forEach(t => sel.appendChild(h('option', { value: t.toLowerCase() }, t)));
    sel.addEventListener('change', () => { state.filter = sel.value; build(); });
  }

  function wireMode() {
    const f = document.getElementById('mode-frac'), d = document.getElementById('mode-dec');
    const set = m => {
      state.mode = m;
      f.setAttribute('aria-pressed', String(m === 'fraction'));
      d.setAttribute('aria-pressed', String(m === 'decimal'));
      build();
    };
    f.addEventListener('click', () => set('fraction'));
    d.addEventListener('click', () => set('decimal'));
  }

  function start() {
    buildFilter();
    wireMode();
    build();
  }

  S.ready(start);
})();
