/* ============================================================
   matrix.js, exact matrix algebra over Fraction
   ------------------------------------------------------------
   All matrices are plain arrays of arrays of Fraction, indexed
   0-based internally (the UI renders 1-based labels).
   ============================================================ */
(function (global) {
  'use strict';

  const F = global.Fraction;
  const Z = () => F.ZERO;
  const O = () => F.ONE;

  /* ---------- construction ---------- */

  function zeros(rows, cols) {
    cols = cols == null ? rows : cols;
    const M = new Array(rows);
    for (let i = 0; i < rows; i++) {
      M[i] = new Array(cols);
      for (let j = 0; j < cols; j++) M[i][j] = Z();
    }
    return M;
  }

  function identity(n) {
    const M = zeros(n, n);
    for (let i = 0; i < n; i++) M[i][i] = O();
    return M;
  }

  function clone(A) { return A.map(row => row.slice()); }

  /** Build a matrix from anything Fraction.from accepts. */
  function from(rows) { return rows.map(r => r.map(v => F.from(v))); }

  /** Permutation matrix for `perm`, where row i of P·A is row perm[i] of A. */
  function permutationMatrix(perm) {
    const n = perm.length;
    const P = zeros(n, n);
    for (let i = 0; i < n; i++) P[i][perm[i]] = O();
    return P;
  }

  /* ---------- shape ---------- */

  const rows = A => A.length;
  const cols = A => (A.length ? A[0].length : 0);

  function isSquare(A) { return rows(A) === cols(A); }

  /* ---------- arithmetic ---------- */

  function mul(A, B) {
    const n = rows(A), m = cols(B), k = cols(A);
    if (k !== rows(B)) throw new Error('mul: dimension mismatch');
    const C = zeros(n, m);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        let s = Z();
        for (let t = 0; t < k; t++) {
          if (A[i][t].isZero() || B[t][j].isZero()) continue;
          s = s.add(A[i][t].mul(B[t][j]));
        }
        C[i][j] = s;
      }
    }
    return C;
  }

  /** Product of several matrices, left to right. */
  function mulAll(...list) { return list.reduce((acc, M) => (acc ? mul(acc, M) : M), null); }

  function sub(A, B) {
    return A.map((row, i) => row.map((v, j) => v.sub(B[i][j])));
  }

  function transpose(A) {
    const n = rows(A), m = cols(A);
    const T = zeros(m, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j][i] = A[i][j];
    return T;
  }

  /** Matrix · column vector (vector given as a flat Fraction array). */
  function mulVec(A, v) {
    return A.map(row => row.reduce((s, a, j) => s.add(a.mul(v[j])), Z()));
  }

  /* ---------- predicates ---------- */

  function equals(A, B) {
    if (rows(A) !== rows(B) || cols(A) !== cols(B)) return false;
    for (let i = 0; i < rows(A); i++)
      for (let j = 0; j < cols(A); j++)
        if (!A[i][j].eq(B[i][j])) return false;
    return true;
  }

  function isSymmetric(A) {
    if (!isSquare(A)) return false;
    const n = rows(A);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (!A[i][j].eq(A[j][i])) return false;
    return true;
  }

  function isZeroMatrix(A) { return A.every(r => r.every(v => v.isZero())); }

  /** Largest absolute entry, used to scale "how big are these numbers" hints. */
  function maxAbs(A) {
    let m = Z();
    for (const row of A) for (const v of row) { const a = v.abs(); if (a.gt(m)) m = a; }
    return m;
  }

  /* ---------- determinant & rank (exact) ---------- */

  /**
   * Exact determinant by fraction-arithmetic Gaussian elimination
   * with row swaps. Returns Fraction.ZERO for singular matrices.
   */
  function det(A) {
    if (!isSquare(A)) throw new Error('det: matrix must be square');
    const n = rows(A);
    if (n === 0) return O();
    const M = clone(A);
    let d = O();
    let sign = 1;

    for (let k = 0; k < n; k++) {
      // Find a non-zero pivot in column k.
      let p = -1;
      for (let i = k; i < n; i++) if (!M[i][k].isZero()) { p = i; break; }
      if (p === -1) return Z();                    // singular
      if (p !== k) { const t = M[p]; M[p] = M[k]; M[k] = t; sign = -sign; }

      d = d.mul(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        if (M[i][k].isZero()) continue;
        const f = M[i][k].div(M[k][k]);
        for (let j = k; j < n; j++) M[i][j] = M[i][j].sub(f.mul(M[k][j]));
      }
    }
    return sign === 1 ? d : d.neg();
  }

  /** Exact rank via row reduction that advances rows and columns independently. */
  function rank(A) {
    const M = clone(A);
    const n = rows(M), m = cols(M);
    let r = 0;
    for (let c = 0; c < m && r < n; c++) {
      let p = -1;
      for (let i = r; i < n; i++) if (!M[i][c].isZero()) { p = i; break; }
      if (p === -1) continue;                      // free column
      if (p !== r) { const t = M[p]; M[p] = M[r]; M[r] = t; }
      for (let i = r + 1; i < n; i++) {
        if (M[i][c].isZero()) continue;
        const f = M[i][c].div(M[r][c]);
        for (let j = c; j < m; j++) M[i][j] = M[i][j].sub(f.mul(M[r][j]));
      }
      r++;
    }
    return r;
  }

  /** The k×k top-left submatrix (k is a count, 1-based size). */
  function leadingBlock(A, k) {
    return A.slice(0, k).map(row => row.slice(0, k));
  }

  /**
   * Leading principal minors D_1 … D_n, i.e. det of the top-left
   * k×k block for each k. These decide whether LDU exists without
   * row swaps, so they are computed and surfaced in the UI.
   */
  function leadingMinors(A) {
    const n = rows(A);
    const out = [];
    for (let k = 1; k <= n; k++) out.push(det(leadingBlock(A, k)));
    return out;
  }

  /** Trace (sum of the diagonal). */
  function trace(A) {
    let s = Z();
    for (let i = 0; i < Math.min(rows(A), cols(A)); i++) s = s.add(A[i][i]);
    return s;
  }

  /* ---------- text I/O ---------- */

  /**
   * Parse a pasted matrix. Rows are separated by newlines or ';',
   * entries by whitespace, commas or tabs. Surrounding brackets,
   * and per-row brackets, are ignored.
   * @returns {{ok:true, matrix:Fraction[][], n:number}|{ok:false, error:string}}
   */
  function parseText(text) {
    if (!text || !String(text).trim()) return { ok: false, error: 'Nothing to parse; the box is empty.' };

    let s = String(text).trim();

    // Drop one layer of outer brackets: "[[1,2],[3,4]]" -> "[1,2],[3,4]".
    s = s.replace(/^[\[\(\{]\s*/, '').replace(/\s*[\]\)\}]$/, '');

    // A closing bracket followed by an opening one ends a row, with or
    // without a comma between: "[1,2],[3,4]" and "[1 2][3 4]" both work.
    s = s.replace(/[\]\)\}]\s*,?\s*[\[\(\{]/g, ';');

    // Any brackets left over are just noise.
    s = s.replace(/[\[\(\{\]\)\}]/g, ' ');

    const lineList = s.split(/[;\n\r]+/).map(l => l.trim()).filter(Boolean);
    if (!lineList.length) return { ok: false, error: 'No rows found.' };

    const out = [];
    for (let i = 0; i < lineList.length; i++) {
      const tokens = lineList[i].split(/[\s,\t]+/).filter(Boolean);
      const row = [];
      for (const tk of tokens) {
        const f = F.parse(tk);
        if (!f) return { ok: false, error: `Row ${i + 1}: "${tk}" is not a number. Use 3, -1.5 or 2/7.` };
        row.push(f);
      }
      out.push(row);
    }

    const width = out[0].length;
    if (out.some(r => r.length !== width))
      return { ok: false, error: `Rows have different lengths (${out.map(r => r.length).join(', ')}). Every row needs the same number of entries.` };

    // One long run of numbers whose count is a perfect square: the user
    // almost certainly pasted a flattened matrix, so fold it back.
    if (out.length === 1 && width > 1) {
      const side = Math.round(Math.sqrt(width));
      if (side * side === width) {
        const folded = [];
        for (let i = 0; i < side; i++) folded.push(out[0].slice(i * side, (i + 1) * side));
        return { ok: true, matrix: folded, n: side, reshaped: true };
      }
    }

    if (out.length !== width)
      return { ok: false, error: `Matrix is ${out.length}×${width}. LDU factorization needs a square matrix.` };

    return { ok: true, matrix: out, n: width };
  }

  /** Plain-text rendering, columns aligned. */
  function toText(A, opts) {
    const o = opts || {};
    const cells = A.map(r => r.map(v => global.FractionUtil.format(v, o)));
    const w = cells.reduce((mx, r) => Math.max(mx, ...r.map(c => c.length)), 0);
    return cells.map(r => r.map(c => c.padStart(w)).join('  ')).join('\n');
  }

  /** LaTeX bmatrix. */
  function toLatex(A) {
    return '\\begin{bmatrix}\n' +
      A.map(r => '  ' + r.map(v => v.toLatex()).join(' & ')).join(' \\\\\n') +
      '\n\\end{bmatrix}';
  }

  /* ---------- random generators ---------- */

  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  /** Random integer matrix in [lo, hi]. */
  function randomMatrix(n, lo, hi) {
    lo = lo == null ? -6 : lo; hi = hi == null ? 9 : hi;
    const M = zeros(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) M[i][j] = new F(BigInt(randInt(lo, hi)));
    return M;
  }

  /**
   * Random matrix guaranteed to factor as A = LDU with no row swaps:
   * build it from a random unit-lower L, non-zero diagonal D and
   * unit-upper U, so every leading principal minor is non-zero by
   * construction. Ideal for teaching the clean case.
   */
  function randomFactorable(n, spread) {
    spread = spread || 3;
    const L = identity(n), D = identity(n), U = identity(n);
    for (let i = 0; i < n; i++) {
      let d = randInt(-spread, spread);
      if (d === 0) d = 1;
      D[i][i] = new F(BigInt(d));
      for (let j = 0; j < i; j++) L[i][j] = new F(BigInt(randInt(-2, 2)));
      for (let j = i + 1; j < n; j++) U[i][j] = new F(BigInt(randInt(-2, 2)));
    }
    return mulAll(L, D, U);
  }

  /** Random symmetric integer matrix. */
  function randomSymmetric(n, lo, hi) {
    const M = randomMatrix(n, lo, hi);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) M[j][i] = M[i][j];
    return M;
  }

  /** Random symmetric positive-definite matrix: A = BᵀB + nI. */
  function randomSPD(n) {
    const B = randomMatrix(n, -3, 3);
    const A = mul(transpose(B), B);
    for (let i = 0; i < n; i++) A[i][i] = A[i][i].add(new F(BigInt(n)));
    return A;
  }

  /** Random singular matrix: last row is a combination of earlier rows. */
  function randomSingular(n) {
    const M = randomMatrix(n, -5, 7);
    if (n < 2) { M[0][0] = Z(); return M; }
    const c1 = new F(BigInt(randInt(1, 3))), c2 = new F(BigInt(randInt(-2, 2)));
    for (let j = 0; j < n; j++) M[n - 1][j] = c1.mul(M[0][j]).add(c2.mul(M[n - 2][j]));
    return M;
  }

  /** Matrix whose (1,1) entry is zero, so LDU needs a row swap. */
  function randomNeedsPivot(n) {
    const M = randomMatrix(n, -5, 8);
    M[0][0] = Z();
    if (n > 1 && M[1][0].isZero()) M[1][0] = new F(2n);
    return M;
  }

  /** Tridiagonal integer matrix. */
  function randomTridiagonal(n) {
    const M = zeros(n, n);
    for (let i = 0; i < n; i++) {
      M[i][i] = new F(BigInt(randInt(2, 6)));
      if (i > 0) M[i][i - 1] = new F(BigInt(randInt(-3, -1)));
      if (i < n - 1) M[i][i + 1] = new F(BigInt(randInt(-3, -1)));
    }
    return M;
  }

  global.Mat = {
    zeros, identity, clone, from, permutationMatrix,
    rows, cols, isSquare,
    mul, mulAll, sub, transpose, mulVec,
    equals, isSymmetric, isZeroMatrix, maxAbs,
    det, rank, leadingBlock, leadingMinors, trace,
    parseText, toText, toLatex,
    randInt, randomMatrix, randomFactorable, randomSymmetric,
    randomSPD, randomSingular, randomNeedsPivot, randomTridiagonal
  };
})(typeof window !== 'undefined' ? window : globalThis);
