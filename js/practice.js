/* ============================================================
   practice.js, generated practice questions
   ------------------------------------------------------------
   Questions are built from freshly generated matrices and the
   correct answer is computed by the same factorization code the
   rest of the site uses. Nothing is hard-coded, so a question
   can never disagree with the algorithm.
   ============================================================ */
(function () {
  'use strict';

  const F = window.Fraction, M = window.Mat, LDU = window.LDU;
  const S = window.Site, R = window.Render;
  const h = S.h, icon = S.icon, ICONS = S.ICONS, clear = S.clear;
  const sub = R.sub;

  /* ---------------- state ---------------- */
  const state = {
    level: 'medium',
    count: 8,
    questions: [],
    index: 0,
    answered: false,
    results: []            // { q, chosen, correct }
  };

  const els = {};
  function $(id) { return document.getElementById(id); }

  /* ---------------- small helpers ---------------- */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Assemble four distinct options from one correct answer and a pool
   * of candidate distractors. Comparison is on the rendered text, so
   * two candidates that display identically can never both appear.
   */
  function buildOptions(correctText, candidates, filler) {
    const seen = new Set([correctText]);
    const out = [{ text: correctText, correct: true }];

    for (const c of candidates) {
      if (out.length >= 4) break;
      if (c === null || c === undefined) continue;
      const t = String(c);
      if (seen.has(t)) continue;
      seen.add(t);
      out.push({ text: t, correct: false });
    }

    // Top up with generated filler if the pool was too small or too similar.
    let guard = 0;
    while (out.length < 4 && guard++ < 200) {
      const t = String(filler());
      if (seen.has(t)) continue;
      seen.add(t);
      out.push({ text: t, correct: false });
    }

    return shuffle(out);
  }

  /** A random non-zero integer Fraction, for filler options. */
  function randFraction() {
    let n = M.randInt(-9, 9);
    if (n === 0) n = 3;
    const d = Math.random() < 0.35 ? M.randInt(2, 6) : 1;
    return new F(BigInt(n), BigInt(d));
  }

  function sizeFor(level) {
    if (level === 'easy') return 2;
    if (level === 'medium') return 3;
    return Math.random() < 0.5 ? 3 : 4;
  }

  /** A matrix that definitely factors cleanly, for questions about L, D, U. */
  function cleanMatrix(level) {
    const n = sizeFor(level);
    for (let t = 0; t < 40; t++) {
      const A = level === 'easy' ? M.randomFactorable(n, 3) : M.randomMatrix(n, -5, 7);
      const res = LDU.factorize(A, { recordSteps: false });
      if (res.status === 'ldu' && !res.isSingular && M.maxAbs(A).lt(new F(40n))) return { A, res };
    }
    const A = M.randomFactorable(sizeFor(level), 3);
    return { A, res: LDU.factorize(A, { recordSteps: false }) };
  }

  /** A matrix chosen so the answer to "does it need a swap?" is varied. */
  function mixedMatrix(level) {
    const n = sizeFor(level);
    const pick = Math.random();
    let A;
    if (pick < 0.35) A = M.randomNeedsPivot(n);
    else if (pick < 0.55) A = M.randomSingular(n);
    else A = M.randomMatrix(n, -5, 7);
    return { A, res: LDU.factorize(A, { recordSteps: false }) };
  }

  function symmetricMatrix(level) {
    const n = sizeFor(level);
    const pick = Math.random();
    let A;
    if (pick < 0.45) A = M.randomSPD(n);
    else A = M.randomSymmetric(n, -4, 6);
    return { A, res: LDU.factorize(A, { recordSteps: false }) };
  }

  /* ---------------- question generators ---------------- */
  /* Each returns { topic, prompt, matrix, options, explain(res) } or null
     when the drawn matrix does not suit the question (the caller retries). */

  const GENERATORS = [
    /* --- a specific pivot --- */
    function pivotQuestion(level) {
      const { A, res } = cleanMatrix(level);
      const k = M.randInt(1, res.n - 1);        // not the first: that one is trivial
      const correct = res.D[k][k];

      const pool = [];
      for (let i = 0; i < res.n; i++) if (i !== k) pool.push(res.D[i][i].toFractionString());
      pool.push(correct.neg().toFractionString());
      pool.push(A[k][k].toFractionString());     // the untouched entry: the classic mistake
      pool.push(res.minors[k].toFractionString());

      return {
        topic: 'pivots',
        matrix: A,
        prompt: `In the LDU factorization of A, what is the pivot d${sub(k + 1)}?`,
        options: buildOptions(correct.toFractionString(), pool, () => randFraction().toFractionString()),
        res,
        explain: () => [
          h('p', {}, [
            'The pivots are the diagonal entries of the eliminated matrix Û, in order: ',
            h('strong', {}, res.pivots.map(p => p.toFractionString()).join(',  ')),
            `. So d${sub(k + 1)} = `,
            h('strong', {}, correct.toFractionString()), '.'
          ]),
          h('p', { class: 'text-sm' }, [
            `A common slip is to read a${sub(k + 1)}${sub(k + 1)} = ${A[k][k].toFractionString()} straight off A. ` +
            'That is the entry before elimination; the pivot is what is left of it after the earlier columns are cleared.'
          ]),
          h('div', { class: 'formula' },
            `d${sub(k + 1)} = D${sub(k + 1)} ÷ D${sub(k)} = ` +
            `${res.minors[k].toFractionString()} ÷ ${k === 0 ? '1' : res.minors[k - 1].toFractionString()} = ${correct.toFractionString()}`)
        ]
      };
    },

    /* --- a specific multiplier of L --- */
    function multiplierQuestion(level) {
      const { A, res } = cleanMatrix(level);
      const i = M.randInt(1, res.n - 1);
      const k = M.randInt(0, i - 1);
      const correct = res.L[i][k];

      const pool = [
        correct.neg().toFractionString(),
        A[i][k].toFractionString(),
        res.U[k] && res.U[k][i] ? res.U[k][i].toFractionString() : null
      ];
      for (let r = 1; r < res.n; r++) for (let c = 0; c < r; c++) pool.push(res.L[r][c].toFractionString());

      return {
        topic: 'the factor L',
        matrix: A,
        prompt: `What is the entry ℓ${sub(i + 1)}${sub(k + 1)} of L?`,
        options: buildOptions(correct.toFractionString(), pool, () => randFraction().toFractionString()),
        res,
        explain: () => [
          h('p', {}, [
            `ℓ${sub(i + 1)}${sub(k + 1)} is the multiplier used to clear position (${i + 1}, ${k + 1}) during stage ${k + 1}: ` +
            'the entry sitting there at that moment, divided by the pivot.'
          ]),
          h('div', { class: 'formula' },
            `ℓ${sub(i + 1)}${sub(k + 1)} = ${correct.toFractionString()}`),
          h('p', { class: 'text-sm' },
            'Note the sign convention: L stores the multiplier as it was used in ' +
            `R${sub(i + 1)} ← R${sub(i + 1)} − ℓ${sub(i + 1)}${sub(k + 1)}·R${sub(k + 1)}, not its negative.`)
        ]
      };
    },

    /* --- does it need a permutation? --- */
    function permutationQuestion(level) {
      const { A, res } = mixedMatrix(level);
      if (res.status === 'no-ldu') return null;
      const needs = res.needsPermutation;
      const firstZero = LDU.firstZeroMinor(res.minors.slice(0, res.n - 1));

      return {
        topic: 'permutations',
        matrix: A,
        prompt : 'Can A be factored as L·D·U with no row swaps?',
        options: shuffle([
          { text: 'Yes; every leading principal minor up to n−1 is non-zero', correct: !needs },
          { text: 'No; a leading principal minor vanishes, so a row swap is needed', correct: needs }
        ]),
        res,
        explain: () => [
          h('p', {}, [
            'The leading principal minors are ',
            h('strong', {}, res.minors.map(m => m.toFractionString()).join(',  ')),
            '. Row swaps are needed exactly when one of the first n−1 of them is zero.'
          ]),
          needs
            ? h('p', {}, [
              'Here D', h('sub', {}, String(firstZero + 1)), ' = 0, so stage ',
              h('strong', {}, String(firstZero + 1)),
              ' has no usable pivot and the result is P·A = L·D·U with ',
              h('strong', {}, String(res.swapCount)), ' swap' + (res.swapCount === 1 ? '' : 's') + '.'
            ])
              : h('p', {}, 'None of them vanish, so elimination runs straight through and P is the identity.')
        ]
      };
    },

    /* --- determinant from the pivots --- */
    function determinantQuestion(level) {
      const { A, res } = mixedMatrix(level);
      if (res.status === 'no-ldu') return null;
      const correct = res.det;
      const prod = res.pivots.reduce((a, b) => a.mul(b), F.ONE);

      const pool = [
        correct.neg().toFractionString(),                     // wrong permutation sign
        prod.toFractionString(),                              // forgot the sign
        M.trace(A).toFractionString(),                        // confused with the trace
        correct.isZero() ? '1' : correct.add(F.ONE).toFractionString()
      ];

      return {
        topic: 'determinants',
        matrix: A,
        prompt : 'What is det A?',
        options: buildOptions(correct.toFractionString(), pool, () => randFraction().toFractionString()),
        res,
        explain: () => [
          h('div', { class: 'formula' },
            'det A = (−1)^' + res.swapCount + ' · ' + res.pivots.map(p => p.toFractionString()).join(' · ') +
            ' = ' + correct.toFractionString()),
          h('p', {}, res.swapCount
            ? `There ${res.swapCount === 1 ? 'was' : 'were'} ${res.swapCount} row swap${res.swapCount === 1 ? '' : 's'}, ` +
              `so det P = ${res.swapCount % 2 ? '−1' : '+1'} and the pivot product picks up that sign.`
                                              : 'No row swaps occurred, so the determinant is simply the product of the pivots.'),
          correct.isZero()
            ? h('p', { class : 'text-sm' }, 'A zero pivot makes the whole product zero; A is singular.')
            : null
        ]
      };
    },

    /* --- rank --- */
    function rankQuestion(level) {
      const { A, res } = mixedMatrix(level);
      const correct = String(res.rank);
      const pool = [];
      for (let r = 0; r <= res.n; r++) if (String(r) !== correct) pool.push(String(r));

      return {
        topic: 'rank',
        matrix: A,
        prompt : 'What is the rank of A?',
        options: buildOptions(correct, shuffle(pool), () => String(M.randInt(0, res.n))),
        res,
        explain: () => [
          h('p', {}, [
            'The rank is the number of independent rows, equivalently the number of non-zero pivots once ' +
            'elimination is complete. The pivots here are ',
            h('strong', {}, res.pivots.map(p => p.toFractionString()).join(',  ')),
            `, giving rank ${res.rank} out of ${res.n}.`
          ]),
          res.isSingular
            ? h('p', {}, `Since rank ${res.rank} < ${res.n}, det A = 0 and A has no inverse.`)
            : h('p', {}, 'Full rank, so A is invertible.')
        ]
      };
    },

    /* --- positive definiteness --- */
    function definiteQuestion(level) {
      const { A, res } = symmetricMatrix(level);
      if (!res.isSymmetric || res.status === 'no-ldu') return null;

      const ds = Array.from({ length: res.n }, (_, i) => res.D[i][i]);
      const pos = ds.filter(d => d.isPositive()).length;
      const neg = ds.filter(d => d.isNegative()).length;
      const zero = ds.filter(d => d.isZero()).length;

      let correct;
      if (zero === 0 && neg === 0) correct = 'Positive definite';
      else if (zero === 0 && pos === 0) correct = 'Negative definite';
      else if (pos > 0 && neg > 0) correct = 'Indefinite';
      else if (neg === 0) correct = 'Positive semi-definite';
      else correct = 'Negative semi-definite';

      const all = ['Positive definite', 'Negative definite', 'Indefinite', 'Positive semi-definite'];

      return {
        topic: 'definiteness',
        matrix: A,
        prompt : 'A is symmetric. How is the quadratic form xᵀAx classified?',
        options: buildOptions(correct, shuffle(all.filter(x => x !== correct)), () => 'Negative semi-definite'),
        res,
        explain: () => [
          h('p', {}, [
            'By Sylvester\'s criterion the signs of the pivots decide it. Here the pivots are ',
            h('strong', {}, ds.map(d => d.toFractionString()).join(',  ')),
            `, ${pos} positive, ${neg} negative, ${zero} zero.`
          ]),
          h('p', {}, correct === 'Positive definite'
            ? 'Every pivot is positive, so xᵀAx > 0 for all non-zero x.'
            : correct === 'Indefinite'
              ? 'The pivots have mixed signs, so xᵀAx takes both positive and negative values.'
              : correct === 'Negative definite'
                ? 'Every pivot is negative, so xᵀAx < 0 for all non-zero x.'
                : 'A zero pivot means the form vanishes on a subspace, so it is only semi-definite.'),
          res.isLDLt ? h('p', { class : 'text-sm' }, 'Because A is symmetric, U came out as exactly Lᵀ; this is the LDLᵀ form.') : null
        ]
      };
    },

    /* --- which minor vanishes first --- */
    function minorQuestion(level) {
      const { A, res } = mixedMatrix(level);
      const firstZero = LDU.firstZeroMinor(res.minors);
      if (firstZero === -1) return null;                   // only ask when one does vanish

      const correct = 'D' + sub(firstZero + 1);
      const pool = [];
      for (let k = 0; k < res.n; k++) if (k !== firstZero) pool.push('D' + sub(k + 1));
      pool.push('none of them vanish');

      return {
        topic: 'leading minors',
        matrix: A,
        prompt : 'Which is the first leading principal minor of A that equals zero?',
        options: buildOptions(correct, shuffle(pool), () => 'none of them vanish'),
        res,
        explain: () => [
          h('div', { class: 'table-wrap', style: 'margin-bottom:12px' }, h('table', { class: 'tbl' }, [
            h('thead', {}, h('tr', {}, [h('th', {}, 'k'), h('th', { class: 'num' }, 'Dₖ')])),
            h('tbody', {}, res.minors.map((m, k) => h('tr', {}, [
              h('td', {}, 'D' + sub(k + 1)),
              h('td', { class: 'num' }, m.isZero()
                ? h('strong', {}, '0')
                : m.toFractionString())
            ])))
          ])),
          h('p', {}, [
            'D', h('sub', {}, String(firstZero + 1)),
            ' is the determinant of the top-left ' + (firstZero + 1) + '×' + (firstZero + 1) +
            ' block, and it is the first to vanish.'
          ]),
          firstZero < res.n - 1
            ? h('p', {}, 'Because it is not the last one, elimination stalls at stage ' + (firstZero + 1) +
              ' and a row swap is required.')
                : h('p', {}, 'Only the last minor vanishes; that is det A itself, so A is singular but no row swap was needed.')
        ]
      };
    },

    /* --- read an entry of U --- */
    function uEntryQuestion(level) {
      const { A, res } = cleanMatrix(level);
      if (res.n < 2) return null;
      const i = M.randInt(0, res.n - 2);
      const j = M.randInt(i + 1, res.n - 1);
      const correct = res.U[i][j];

      const pool = [
        res.Uhat[i][j].toFractionString(),          // forgot to divide by the pivot
        correct.neg().toFractionString(),
        A[i][j].toFractionString(),
        res.L[j] ? res.L[j][i].toFractionString() : null
      ];

      return {
        topic: 'the factor U',
        matrix: A,
        prompt: `What is the entry u${sub(i + 1)}${sub(j + 1)} of U?`,
        options: buildOptions(correct.toFractionString(), pool, () => randFraction().toFractionString()),
        res,
        explain: () => [
          h('p', {}, [
            'U is the eliminated matrix Û with each row divided by its own pivot. Row ',
            h('strong', {}, String(i + 1)), ' of Û has ', h('strong', {}, res.Uhat[i][j].toFractionString()),
            ' in column ', h('strong', {}, String(j + 1)), ', and the pivot for that row is ',
            h('strong', {}, res.D[i][i].toFractionString()), '.'
          ]),
          h('div', { class: 'formula' },
            `u${sub(i + 1)}${sub(j + 1)} = ${res.Uhat[i][j].toFractionString()} ÷ ${res.D[i][i].toFractionString()} = ${correct.toFractionString()}`),
          h('p', { class: 'text-sm' },
            'Skipping that division is the most common mistake here; it gives the LU answer rather than the LDU one.')
        ]
      };
    }
  ];

  /* ---------------- building a round ---------------- */
  function makeQuestions(level, count) {
    const out = [];
    const recentTopics = [];
    let guard = 0;

    while (out.length < count && guard++ < count * 60) {
      const gen = GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
      let q;
      try { q = gen(level); } catch (e) { q = null; }
      if (!q) continue;

      // Every question needs exactly one correct option.
      const nCorrect = q.options.filter(o => o.correct).length;
      if (nCorrect !== 1 || q.options.length < 2) continue;

      // Avoid asking the same topic three times running.
      if (recentTopics.length >= 2 && recentTopics[0] === q.topic && recentTopics[1] === q.topic) continue;
      recentTopics.unshift(q.topic);
      recentTopics.length = Math.min(recentTopics.length, 2);

      out.push(q);
    }
    return out;
  }

  /* ---------------- rendering ---------------- */
  function renderProgress() {
    const host = els.progress;
    clear(host);
    state.questions.forEach((q, i) => {
      let cls = 'quiz-dot';
      const r = state.results[i];
      if (r) cls += r.correct ? ' done-ok' : ' done-bad';
      else if (i === state.index) cls += ' current';
      host.appendChild(h('span', { class: cls }));
    });
  }

  function renderQuestion() {
    const q = state.questions[state.index];
    state.answered = false;

    els.counter.textContent = `Question ${state.index + 1} of ${state.questions.length}`;
    els.topic.textContent = q.topic;
    els.prompt.textContent = q.prompt;
    els.hint.classList.remove('hidden');
    els.next.classList.add('hidden');
    clear(els.feedback);

    clear(els.qMatrix);
    els.qMatrix.appendChild(h('div', { class: 'row', style: 'gap:12px;align-items:center' }, [
      h('span', { class: 'mx-name' }, 'A'),
      h('span', { class: 'mx-eq' }, '='),
      R.matrix(q.matrix, { rails: true, ariaLabel: 'Matrix A' })
    ]));

    clear(els.options);
    q.options.forEach((opt, i) => {
      const btn = h('button', { class: 'quiz-opt', type: 'button', 'data-idx': i }, [
        h('span', { class: 'key' }, String(i + 1)),
        h('span', {}, opt.text)
      ]);
      btn.addEventListener('click', () => answer(i));
      els.options.appendChild(btn);
    });

    renderProgress();
  }

  function answer(idx) {
    if (state.answered) return;
    state.answered = true;

    const q = state.questions[state.index];
    const chosen = q.options[idx];
    const correctIdx = q.options.findIndex(o => o.correct);

    Array.from(els.options.children).forEach((btn, i) => {
      btn.disabled = true;
      if (i === correctIdx) btn.classList.add('correct');
      else if (i === idx) btn.classList.add('wrong');
    });

    state.results[state.index] = { q, chosen: idx, correct: !!chosen.correct };
    els.hint.classList.add('hidden');

    /* feedback */
    clear(els.feedback);
    els.feedback.appendChild(h('div', {
      class : 'alert ' + (chosen.correct ? 'alert-ok' : 'alert-err'),
      style: 'margin-top:8px'
    }, [
      icon(chosen.correct ? ICONS.check : ICONS.x),
      h('div', {}, [
        h('span', { class : 'alert-title' }, chosen.correct ? 'Correct' : 'Not quite'),
        h('p', {}, chosen.correct
          ? 'That is the value the factorization produces.'
          : 'The correct answer is ' + q.options[correctIdx].text + '.')
      ])
    ]));

    els.feedback.appendChild(h('details', { open: true, class: 'panel', style: 'margin-top:14px' }, [
      h('summary', { style: 'cursor:pointer;font-weight:650;color:var(--primary)' }, 'Why'),
      h('div', { style: 'padding-top:14px;display:grid;gap:12px' }, q.explain())
    ]));

    els.feedback.appendChild(h('details', { class: 'panel', style: 'margin-top:10px' }, [
      h('summary', { style: 'cursor:pointer;font-weight:650;color:var(--primary)' }, 'The full factorization'),
      h('div', { style: 'padding-top:14px' }, factorizationSummary(q.res))
    ]));

    els.next.classList.remove('hidden');
    els.next.textContent = state.index + 1 >= state.questions.length ? 'See results' : 'Next question';
    els.next.focus();
    renderProgress();
  }

  function factorizationSummary(res) {
    const items = [];
    if (res.needsPermutation) { items.push({ name: 'P', matrix: res.P }); items.push({ op: '·' }); }
    items.push({ name: 'A', matrix: res.A });
    items.push({ op: '=' });
    items.push({ name: 'L', matrix: res.L, opts: { unit: true } });
    items.push({ op: '·' });
    items.push({ name: 'D', matrix: res.D, opts: { diag: true } });
    items.push({ op: '·' });
    items.push({ name: 'U', matrix: res.U, opts: { unit: true } });

    return h('div', { style: 'display:grid;gap:12px' }, [
      h('div', { class: 'mx-scroll' }, R.equation(items)),
      h('div', { class: 'row', style: 'gap:6px' }, [
        h('span', { class: 'badge' }, 'det = ' + res.det.toFractionString()),
        h('span', { class: 'badge' }, 'rank ' + res.rank + '/' + res.n),
        res.verification.matches
          ? h('span', { class : 'badge badge-ok badge-dot' }, 'verified')
          : h('span', { class: 'badge badge-err badge-dot' }, 'failed'),
        h('a', {
          class: 'badge badge-brand',
          href: 'calculator.html#m=' + encodeURIComponent(res.A.map(r => r.map(v => v.toFractionString()).join(',')).join(';'))
        }, 'open in calculator →')
      ])
    ]);
  }

  function next() {
    if (state.index + 1 >= state.questions.length) { showResults(); return; }
    state.index++;
    renderQuestion();
    els.quizCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function showResults() {
    const done = state.results.filter(Boolean);
    const right = done.filter(r => r.correct).length;
    const total = state.questions.length;
    const pct = total ? Math.round((right / total) * 100) : 0;

    els.quizCard.classList.add('hidden');
    els.resultCard.classList.remove('hidden');

    els.ring.style.setProperty('--pct', String(pct));
    els.scoreText.textContent = pct + '%';
    els.scoreTitle.textContent = `${right} of ${total} correct`;

    els.scoreBlurb.textContent =
      pct === 100 ? 'Every question right. You can read the factorization off a matrix with confidence.'
                  : pct >= 75 ? 'Solid. Look over the ones you missed below; the reasoning is included.'
                              : pct >= 50 ? 'A reasonable start. The explanations below point at what to revisit.'
                                          : 'Worth another pass through the theory and the algorithm before trying again.';

    /* per-topic breakdown */
    const byTopic = {};
    done.forEach(r => {
      const t = r.q.topic;
      byTopic[t] = byTopic[t] || { right: 0, total: 0 };
      byTopic[t].total++;
      if (r.correct) byTopic[t].right++;
    });

    clear(els.review);

    els.review.appendChild(h('h3', { style: 'margin-bottom:12px' }, 'By topic'));
    els.review.appendChild(h('div', { class: 'table-wrap', style: 'margin-bottom:28px' },
      h('table', { class: 'tbl' }, [
        h('thead', {}, h('tr', {}, [h('th', {}, 'Topic'), h('th', { class: 'num' }, 'Score'), h('th', {}, '')])),
        h('tbody', {}, Object.keys(byTopic).map(t => {
          const s = byTopic[t];
          const all = s.right === s.total;
          return h('tr', {}, [
            h('td', {}, h('strong', {}, t)),
            h('td', { class: 'num' }, s.right + ' / ' + s.total),
            h('td', {}, h('span', { class : 'badge ' + (all ? 'badge-ok' : 'badge-warn') + ' badge-dot' },
              all ? 'all correct' : 'review'))
          ]);
        }))
      ])
    ));

    const missed = done.filter(r => !r.correct);
    if (missed.length) {
      els.review.appendChild(h('h3', { style: 'margin-bottom:12px' }, 'What to look at again'));
      const list = h('div', { class: 'steps' });
      missed.forEach((r, i) => {
        list.appendChild(h('details', { class: 'step' }, [
          h('summary', {}, [
            h('span', { class: 'step-num' }, String(i + 1)),
            h('span', {}, r.q.prompt)
          ]),
          h('div', { class: 'step-body' }, [
            h('div', { class: 'row', style: 'gap:8px' }, [
              h('span', { class: 'badge badge-err badge-dot' }, 'you chose: ' + r.q.options[r.chosen].text),
              h('span', { class: 'badge badge-ok badge-dot' }, 'correct: ' + r.q.options.find(o => o.correct).text)
            ]),
            h('div', { class: 'mx-scroll' }, R.matrix(r.q.matrix, { rails: true })),
            h('div', { style: 'display:grid;gap:12px' }, r.q.explain()),
            factorizationSummary(r.q.res)
          ])
        ]));
      });
      els.review.appendChild(list);
    }

    els.resultCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function startRound() {
    state.level = els.level.value;
    state.count = parseInt(els.count.value, 10) || 8;
    state.questions = makeQuestions(state.level, state.count);
    state.index = 0;
    state.results = [];

    if (!state.questions.length) {
      S.toast('Could not generate questions, please try again.', 3000);
      return;
    }

    els.setupCard.classList.add('hidden');
    els.resultCard.classList.add('hidden');
    els.quizCard.classList.remove('hidden');
    renderQuestion();
    els.quizCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function reset() {
    els.resultCard.classList.add('hidden');
    els.quizCard.classList.add('hidden');
    els.setupCard.classList.remove('hidden');
    els.setupCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ---------------- boot ---------------- */
  function start() {
    els.setupCard = $('setup-card');
    els.quizCard = $('quiz-card');
    els.resultCard = $('result-card');
    els.level = $('level-select');
    els.count = $('count-select');
    els.counter = $('q-counter');
    els.topic = $('q-topic');
    els.prompt = $('q-prompt');
    els.qMatrix = $('q-matrix');
    els.options = $('q-options');
    els.hint = $('q-hint');
    els.feedback = $('q-feedback');
    els.progress = $('progress-host');
    els.next = $('next-btn');
    els.ring = $('score-ring');
    els.scoreText = $('score-text');
    els.scoreTitle = $('score-title');
    els.scoreBlurb = $('score-blurb');
    els.review = $('review-host');

    $('start-btn').addEventListener('click', startRound);
    $('again-btn').addEventListener('click', reset);
    $('quit-btn').addEventListener('click', () => {
      if (state.results.filter(Boolean).length) showResults();
      else reset();
    });
    els.next.addEventListener('click', next);

    /* keyboard: 1–4 to answer, Enter/space to advance */
    document.addEventListener('keydown', e => {
      if (els.quizCard.classList.contains('hidden')) return;
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

      if (!state.answered && /^[1-9]$/.test(e.key)) {
        const i = parseInt(e.key, 10) - 1;
        if (i < els.options.children.length) { e.preventDefault(); answer(i); }
      } else if (state.answered && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      }
    });

    document.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      if (ICONS[name]) el.appendChild(icon(ICONS[name]));
    });
  }

  S.ready(start);
})();
