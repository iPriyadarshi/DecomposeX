/* ============================================================
   examples-data.js: the worked-example library
   ------------------------------------------------------------
   One source of truth for the Examples gallery, the calculator's
   preset menu and the Applications page. Each entry carries the
   matrix plus the single idea it is meant to teach.

   `expect` records the outcome the entry is chosen to illustrate;
   it is asserted by the test suite so the prose can never drift
   away from what the code actually produces.
   ============================================================ */
(function (global) {
  'use strict';

  /** Groups, in the order the gallery shows them. */
  const GROUPS = [
    { id: 'start',     title: 'Start here',                     blurb: 'The clean case: elimination runs straight through and every factor comes out tidy.' },
    { id: 'fractions', title: 'When fractions appear',          blurb: 'Integer matrices rarely give integer factors. These show why exact arithmetic matters.' },
    { id: 'symmetric', title: 'Symmetric matrices',            blurb: 'Symmetry makes U the transpose of L, collapsing LDU into the LDLᵀ form.' },
    { id: 'pivoting',  title: 'When a row swap is needed',      blurb: 'A zero pivot is not the end: a permutation gives P·A = L·D·U.' },
    { id: 'singular',  title: 'Singular matrices',              blurb: 'A zero on the diagonal of D. Sometimes LDU survives; sometimes it genuinely does not exist.' },
    { id: 'special',   title: 'Special shapes',                 blurb: 'Triangular, tridiagonal and famously ill-conditioned matrices.' }
  ];

  const EXAMPLES = [
    /* ---------------- start ---------------- */
    {
      id: 'first-2x2',
      group: 'start',
      title: 'A first 2×2',
      blurb: 'One multiplier, one row operation. The whole method in miniature.',
      rows: [['4', '3'], ['6', '3']],
      tags: ['2×2', 'clean'],
      note: 'One elimination clears the single entry below the pivot: ℓ₂₁ = 6 ÷ 4 = 3/2. The pivots 4 and −3/2 become D, and dividing each row of the eliminated matrix by its pivot gives U.',
      b: ['5', '3'],
      expect: { status: 'ldu', permuted: false, singular: false }
    },
    {
      id: 'classic-3x3',
      group: 'start',
      title: 'The textbook 3×3',
      blurb: 'The example most courses open with. Integer L and D, fractional U.',
      rows: [['2', '1', '1'], ['4', '-6', '0'], ['-2', '7', '2']],
      tags: ['3×3', 'clean'],
      note: 'Pivots 2, −8 and 1 give det A = 2 · (−8) · 1 = −16. Notice that L and D stay integral while U picks up halves and quarters; normalising the rows is what introduces the fractions.',
      b: ['5', '-2', '9'],
      expect: { status: 'ldu', permuted: false, singular: false }
    },
    {
      id: 'clean-4x4',
      group: 'start',
      title: 'A 4×4 built to be clean',
      blurb: 'Constructed as L·D·U from integer factors, so it factors back perfectly.',
      rows: [
        ['2', '4', '-2', '2'],
        ['4', '9', '-3', '8'],
        ['-2', '-3', '7', '-2'],
        ['6', '13', '-5', '17']
      ],
      tags: ['4×4', 'clean'],
      note: 'Working backwards from known factors is the easiest way to build practice problems: pick a unit lower-triangular L, a non-zero diagonal D and a unit upper-triangular U, then multiply.',
      expect: { status: 'ldu', permuted: false, singular: false }
    },

    /* ---------------- fractions ---------------- */
    {
      id: 'fractions-2x2',
      group: 'fractions',
      title: 'Small integers, immediate fractions',
      blurb: 'Every entry is an integer, yet the factors are not.',
      rows: [['2', '3'], ['5', '7']],
      tags: ['2×2', 'fractions'],
      note: 'ℓ₂₁ = 5/2 and d₂ = −1/2. In floating point the second pivot would be −0.5000000000000004 for many similar matrices; here it is exactly −1/2, so the determinant comes out as exactly −1.',
      expect: { status: 'ldu', permuted: false, singular: false }
    },
    {
      id: 'fraction-input',
      group: 'fractions',
      title: 'Fractions going in',
      blurb: 'Entries can be typed as fractions, and they stay fractions.',
      rows: [['1/2', '1/3'], ['1/4', '1/5']],
      tags: ['2×2', 'fractions'],
      note: 'det A = 1/2 · 1/5 − 1/3 · 1/4 = 1/10 − 1/12 = 1/60. A floating-point calculation gives 0.016666666666666663: close, but not a number you can recognise.',
      expect: { status: 'ldu', permuted: false, singular: false }
    },
    {
      id: 'hilbert-3',
      group: 'fractions',
      title: 'The 3×3 Hilbert matrix',
      blurb: 'The standard example of an ill-conditioned matrix. Exact arithmetic handles it without blinking.',
      rows: [['1', '1/2', '1/3'], ['1/2', '1/3', '1/4'], ['1/3', '1/4', '1/5']],
      tags: ['3×3', 'symmetric', 'ill-conditioned'],
      note: 'H is symmetric positive definite with det H = 1/2160. Its pivots shrink fast (1, 1/12, 1/180), which is precisely what makes it numerically nasty in floating point and perfectly fine in exact arithmetic.',
      expect: { status: 'ldu', permuted: false, singular: false, symmetric: true, spd: true }
    },

    {
      id: 'float-trap',
      group: 'fractions',
      title: 'The floating-point trap',
      blurb: 'Exactly singular, yet double precision reports it as invertible.',
      rows: [['4/7', '5/7', '8/9'], ['1/3', '7/6', '8/9'], ['15/7', '69/14', '40/9']],
      tags: ['3×3', 'singular', 'exact arithmetic'],
      note: 'Row 3 is exactly 2·(row 1) + 3·(row 2), so det A = 0 and the rank is 2. Computed in IEEE-754 doubles, the third pivot lands near 4.4 × 10⁻¹⁶ instead of 0; the test for a zero pivot fails, no warning is raised, and the matrix is declared invertible. The Algorithm page runs both arithmetics side by side.',
      expect: { status: 'ldu', permuted: false, singular: true, rank: 2 }
    },

    /* ---------------- symmetric ---------------- */
    {
      id: 'spd-3x3',
      group: 'symmetric',
      title: 'Symmetric positive definite',
      blurb: 'U comes out as exactly Lᵀ, so A = L·D·Lᵀ.',
      rows: [['4', '2', '2'], ['2', '5', '3'], ['2', '3', '6']],
      tags: ['3×3', 'symmetric', 'positive definite'],
      note: 'All three pivots are positive (4, 4, 4), so by Sylvester\'s criterion A is positive definite. Replacing D by √D turns the factorization into the Cholesky form A = R·Rᵀ.',
      b: ['8', '10', '11'],
      expect: { status: 'ldu', permuted: false, singular: false, symmetric: true, spd: true }
    },
    {
      id: 'sym-indefinite',
      group: 'symmetric',
      title: 'Symmetric but indefinite',
      blurb: 'Still LDLᵀ, but a negative pivot rules out positive definiteness.',
      rows: [['1', '2'], ['2', '1']],
      tags: ['2×2', 'symmetric', 'indefinite'],
      note: 'The pivots are 1 and −3. Symmetry alone gives U = Lᵀ; it takes strictly positive pivots to make A positive definite. A negative pivot means the quadratic form xᵀAx takes negative values.',
      expect: { status: 'ldu', permuted: false, singular: false, symmetric: true, spd: false }
    },
    {
      id: 'tridiagonal',
      group: 'symmetric',
      title: 'The −1, 2, −1 tridiagonal matrix',
      blurb: 'The matrix of the discretised second derivative. Its pivots follow a pattern.',
      rows: [['2', '-1', '0'], ['-1', '2', '-1'], ['0', '-1', '2']],
      tags: ['3×3', 'symmetric', 'tridiagonal', 'positive definite'],
      note: 'The pivots are 2, 3/2, 4/3, and in general (k+1)/k, so det = n+1 for the n×n version. Elimination never touches a zero entry outside the three diagonals, which is why tridiagonal systems solve in linear time.',
      b: ['1', '0', '1'],
      expect: { status: 'ldu', permuted: false, singular: false, symmetric: true, spd: true }
    },

    /* ---------------- pivoting ---------------- */
    {
      id: 'swap-2x2',
      group: 'pivoting',
      title: 'The smallest zero pivot',
      blurb: 'An invertible matrix with no LDU factorization at all, until you swap rows.',
      rows: [['0', '1'], ['1', '0']],
      tags: ['2×2', 'permutation'],
      note: 'a₁₁ = 0, so nothing can be divided by it. The matrix is perfectly invertible (det = −1); it is the *factorization without permutation* that fails, because the leading principal minor D₁ = 0. One swap makes P·A = I, and the factors are all identities.',
      expect: { status: 'pldu', permuted: true, singular: false }
    },
    {
      id: 'swap-3x3',
      group: 'pivoting',
      title: 'A zero pivot inside a 3×3',
      blurb: 'The first entry is zero, so the permutation appears before any elimination.',
      rows: [['0', '2', '1'], ['1', '1', '1'], ['3', '0', '2']],
      tags: ['3×3', 'permutation'],
      note: 'Rows 1 and 2 trade places first. Because a swap happened, the determinant picks up a sign: det A = (−1)¹ · (product of pivots).',
      b: ['4', '3', '7'],
      expect: { status: 'pldu', permuted: true, singular: false }
    },
    {
      id: 'swap-later',
      group: 'pivoting',
      title: 'A pivot that vanishes mid-elimination',
      blurb: 'The first pivot is fine; the second only becomes zero after the first stage.',
      rows: [['1', '2', '3'], ['2', '4', '7'], ['3', '5', '3']],
      tags: ['3×3', 'permutation'],
      note: 'After clearing column 1, position (2,2) holds 0; it was not zero in A. Zero pivots cannot be spotted by looking at the original entries; only the leading principal minors reveal them in advance. Here D₂ = 1·4 − 2·2 = 0.',
      expect: { status: 'pldu', permuted: true, singular: false }
    },

    /* ---------------- singular ---------------- */
    {
      id: 'singular-rank1',
      group: 'singular',
      title: 'Singular, but LDU still exists',
      blurb: 'Row 2 is twice row 1. Elimination empties it completely.',
      rows: [['1', '2'], ['2', '4']],
      tags: ['2×2', 'singular', 'rank 1'],
      note: 'd₂ = 0. Because row 2 of the eliminated matrix is entirely zero, row 2 of D·U is zero whatever U holds, so the identity A = L·D·U still holds, but U is no longer unique. Singular does not automatically mean "no factorization".',
      expect: { status: 'ldu', permuted: false, singular: true, rank: 1 }
    },
    {
      id: 'all-ones',
      group: 'singular',
      title: 'The all-ones matrix',
      blurb: 'Rank 1: two of the three pivots are zero.',
      rows: [['1', '1', '1'], ['1', '1', '1'], ['1', '1', '1']],
      tags: ['3×3', 'singular', 'rank 1'],
      note: 'One elimination stage wipes out rows 2 and 3 entirely. D = diag(1, 0, 0) and the factorization holds, with two rows of U free to be anything unit-triangular.',
      expect: { status: 'ldu', permuted: false, singular: true, rank: 1 }
    },
    {
      id: 'no-ldu',
      group: 'singular',
      title: 'No LDU factorization exists',
      blurb: 'A zero pivot with a non-zero row beside it. The one genuine failure.',
      rows: [['0', '1'], ['0', '2']],
      tags: ['2×2', 'singular', 'no factorization'],
      note: 'Column 1 is entirely zero, so no swap can produce a pivot and d₁ = 0. But row 1 of the eliminated matrix is (0, 1) ≠ 0, and d₁ = 0 forces row 1 of D·U to vanish. The two cannot be reconciled: this matrix has an LU factorization but no LDU with unit-triangular factors.',
      expect: { status: 'no-ldu', singular: true, rank: 1 }
    },

    /* ---------------- special ---------------- */
    {
      id: 'already-upper',
      group: 'special',
      title: 'Already upper triangular',
      blurb: 'Nothing to eliminate: L is the identity.',
      rows: [['1', '2', '3'], ['0', '4', '5'], ['0', '0', '6']],
      tags: ['3×3', 'triangular'],
      note: 'Every multiplier is zero, so L = I and D holds the diagonal of A. The only work left is scaling each row to put 1s on the diagonal of U. det A is just the product of the diagonal: 24.',
      expect: { status: 'ldu', permuted: false, singular: false }
    },
    {
      id: 'already-lower',
      group: 'special',
      title: 'Already lower triangular',
      blurb: 'The mirror case: U comes out as the identity.',
      rows: [['2', '0', '0'], ['3', '4', '0'], ['5', '6', '7']],
      tags: ['3×3', 'triangular'],
      note: 'Elimination clears the lower entries and leaves a diagonal matrix, so U = I and L holds the scaled multipliers. A lower-triangular matrix is its own L·D with L = A·D⁻¹.',
      expect: { status: 'ldu', permuted: false, singular: false }
    },
    {
      id: 'identity-3',
      group: 'special',
      title: 'The identity',
      blurb: 'The degenerate case worth checking: L = D = U = I.',
      rows: [['1', '0', '0'], ['0', '1', '0'], ['0', '0', '1']],
      tags: ['3×3', 'trivial'],
      note: 'A useful sanity check on any implementation. Every multiplier is zero and every pivot is one, so all three factors are the identity.',
      expect: { status: 'ldu', permuted: false, singular: false }
    },
    {
      id: 'big-integers',
      group: 'special',
      title: 'Large integers',
      blurb: 'Nine-digit entries, factored without losing a single digit.',
      rows: [['123456789', '987654321'], ['555555555', '444444444']],
      tags: ['2×2', 'exact arithmetic'],
      note: 'Arbitrary-precision integers mean the numerators and denominators grow but never round. A double has about 15–16 significant digits; products of these entries need more than 18, so floating point would already be wrong here.',
      expect: { status: 'ldu', permuted: false, singular: false }
    }
  ];

  /** Convert an example's string rows into an exact matrix. */
  function toMatrix(ex) {
    return global.Mat.from(ex.rows);
  }

  /** Right-hand side as Fractions, or null. */
  function toVector(ex) {
    if (!ex.b) return null;
    return ex.b.map(v => global.Fraction.from(v));
  }

  function byId(id) { return EXAMPLES.find(e => e.id === id) || null; }
  function byGroup(g) { return EXAMPLES.filter(e => e.group === g); }

  /** Every distinct tag, for the gallery filter. */
  function allTags() {
    const set = new Set();
    EXAMPLES.forEach(e => e.tags.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }

  global.ExampleData = { GROUPS, EXAMPLES, toMatrix, toVector, byId, byGroup, allTags };
})(typeof window !== 'undefined' ? window : globalThis);
