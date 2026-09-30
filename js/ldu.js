/* ============================================================
   ldu.js: LDU factorization, done exactly and honestly
   ------------------------------------------------------------
   THE MATH, IN TWO PHASES

   Phase 1 (elimination).  Gaussian elimination with row swaps
     turns A into an upper-triangular Û while recording every
     multiplier in a unit lower-triangular L:

         P·A = L·Û

     Row i of the k-th stage is replaced by
         row_i ← row_i − m_ik · row_k,   m_ik = Û[i][k] / Û[k][k]
     and m_ik is stored as L[i][k].

   Phase 2 (the D/U split).  Û is scaled row-by-row so its
     diagonal moves into D and what is left is *unit* upper
     triangular:

         D = diag(Û[0][0], …, Û[n-1][n-1]),   U = D⁻¹·Û
         ⇒  P·A = L·D·U

     This split needs every Û[k][k] ≠ 0. A single zero diagonal
     entry means A is singular and no LDU with unit-triangular
     factors exists: the one genuine failure case, which this
     module reports instead of dividing by zero.

   WHAT THE OLD IMPLEMENTATION GOT WRONG
     · divided by a zero pivot, producing NaN / Infinity silently
     · never permuted rows, so it failed on matrices that only
       need a row swap (e.g. [[0,1],[1,0]])
     · accumulated floating-point error and hid it behind
       toFixed(2), so a mathematically exact 0 printed as "-0.00"
     · never verified that L·D·U actually reproduces A
     · reported nothing about singularity or rank

   Every number here is an exact Fraction, so a pivot that is
   mathematically zero tests as exactly zero.
   ============================================================ */
(function (global) {
  'use strict';

  const F = global.Fraction;
  const M = global.Mat;

  /** Pivoting strategies. */
  const PIVOT = {
    NEVER: 'never',        // textbook LDU: fail if a pivot is zero
    WHEN_ZERO: 'when-zero',// swap only when forced (keeps P = I where possible)
    LARGEST: 'largest'     // partial pivoting, as numerical libraries do
  };

  /* ------------------------------------------------------------
     factorize(A, options)
     ------------------------------------------------------------
     @param {Fraction[][]} A0  square matrix
     @param {{pivot?:string, recordSteps?:boolean}} [options]
     @returns {object} see the result shape documented inline
     ------------------------------------------------------------ */
  function factorize(A0, options) {
    const opt = Object.assign({ pivot: PIVOT.WHEN_ZERO, recordSteps: true }, options || {});
    const n = M.rows(A0);

    if (!M.isSquare(A0)) throw new Error('LDU factorization requires a square matrix.');

    const res = {
      n,
      A: M.clone(A0),
      pivotMode: opt.pivot,
      L: M.identity(n),
      D: M.zeros(n, n),
      U: M.identity(n),
      Uhat: null,            // the echelon form Û = D·U
      P: null,
      perm: Array.from({ length: n }, (_, i) => i),
      swaps: [],
      swapCount: 0,
      needsPermutation: false,
      steps: [],
      // diagnostics
      pivots: [],            // Fraction per column (Û[k][k])
      zeroPivotAt: -1,       // first k with Û[k][k] === 0, or -1
      det: null,
      rank: 0,
      nullity: 0,
      isSingular: false,
      isSymmetric: M.isSymmetric(A0),
      isSPD: false,
      isLDLt: false,         // U === Lᵀ (symmetric case)
      minors: [],
      minorsAllNonzero: false,
      status: '',            // 'ldu' | 'pldu' | 'no-ldu' | 'needs-pivot' | 'trivial'
      ok: false,
      messages: [],
      verification: null
    };

    const say = (level, text) => res.messages.push({ level, text });

    if (n === 0) {
      res.status = 'trivial';
      res.ok = true;
      res.det = F.ONE;
      res.P = M.identity(0);
      res.Uhat = M.zeros(0, 0);
      res.verification = { product: [], target: [], matches: true };
      return res;
    }

    /* ---- diagnostics computed up front: they explain the outcome ---- */
    res.det = M.det(A0);
    res.rank = M.rank(A0);
    res.nullity = n - res.rank;
    res.isSingular = res.det.isZero();
    res.minors = M.leadingMinors(A0);
    // LDU exists with P = I  ⟺  every leading principal minor D_1 … D_{n-1} ≠ 0.
    res.minorsAllNonzero = res.minors.slice(0, n - 1).every(m => !m.isZero());

    /* ================= Phase 1: elimination ================= */
    const W = M.clone(A0);              // working matrix → becomes Û
    const L = res.L;

    if (opt.recordSteps) {
      res.steps.push({
        type: 'init', stage: -1,
        matrix: M.clone(W),
        L: M.clone(L)
      });
    }

    for (let k = 0; k < n; k++) {
      /* --- pivot selection --- */
      let pivotRow = k;

      if (opt.pivot === PIVOT.LARGEST) {
        // Choose the largest magnitude entry in column k, rows k.n-1.
        let best = W[k][k].abs();
        for (let i = k + 1; i < n; i++) {
          const a = W[i][k].abs();
          if (a.gt(best)) { best = a; pivotRow = i; }
        }
      } else if (W[k][k].isZero()) {
        // Only look for a swap when the natural pivot is zero.
        pivotRow = -1;
        for (let i = k + 1; i < n; i++) if (!W[i][k].isZero()) { pivotRow = i; break; }

        if (pivotRow === -1) {
          /* Column k is zero from row k down. Nothing to eliminate and
             no pivot to be had. Û[k][k] stays 0 and Phase 2 will decide
             whether an LDU is still expressible. */
          pivotRow = k;
          if (opt.recordSteps) {
            res.steps.push({
              type: 'null-column', stage: k, k,
              matrix: M.clone(W), L: M.clone(L)
            });
          }
          res.pivots.push(W[k][k]);
          continue;
        }

        if (opt.pivot === PIVOT.NEVER) {
          // Textbook LDU has no P, so this is a hard stop.
          res.status = 'needs-pivot';
          res.zeroPivotAt = k;
          res.pivots.push(W[k][k]);
          res.Uhat = M.clone(W);
          res.P = M.identity(n);
          say('error',
            `Pivot ${sub('a', k + 1, k + 1)} is zero at stage ${k + 1}, and row swaps are disabled. ` +
            `A matrix factors as A = LDU with no permutation exactly when every leading principal ` +
            `minor D₁ … D${subDigits(n - 1)} is non-zero; here D${subDigits(k + 1)} = 0. ` +
            `Switch pivoting on to get the permuted form P·A = L·D·U.`);
          res.verification = verify(res);
          return res;
        }
      }

      /* --- row swap --- */
      if (pivotRow !== k) {
        const t = W[pivotRow]; W[pivotRow] = W[k]; W[k] = t;

        // Multipliers already stored in columns < k travel with their rows.
        for (let j = 0; j < k; j++) {
          const tmp = L[pivotRow][j]; L[pivotRow][j] = L[k][j]; L[k][j] = tmp;
        }

        const pt = res.perm[pivotRow]; res.perm[pivotRow] = res.perm[k]; res.perm[k] = pt;
        res.swaps.push({ stage: k, from: k, to: pivotRow });
        res.swapCount++;
        res.needsPermutation = true;

        if (opt.recordSteps) {
          res.steps.push({
            type: 'swap', stage: k, k, rowA: k, rowB: pivotRow,
            reason : opt.pivot === PIVOT.LARGEST ? 'largest' : 'zero-pivot',
            matrix: M.clone(W), L: M.clone(L)
          });
        }
      }

      const pivot = W[k][k];
      res.pivots.push(pivot);

      if (pivot.isZero()) continue;   // can only happen under LARGEST on a null column

      if (opt.recordSteps) {
        res.steps.push({
          type: 'pivot', stage: k, k, pivot,
          matrix: M.clone(W), L: M.clone(L)
        });
      }

      /* --- eliminate below the pivot --- */
      for (let i = k + 1; i < n; i++) {
        const aik = W[i][k];
        if (aik.isZero()) {
          L[i][k] = F.ZERO;
          if (opt.recordSteps) {
            res.steps.push({
              type: 'skip', stage: k, k, i, pivot,
              matrix: M.clone(W), L: M.clone(L)
            });
          }
          continue;
        }

        const m = aik.div(pivot);
        L[i][k] = m;

        const before = W[i].slice();
        for (let j = k; j < n; j++) {
          W[i][j] = W[i][j].sub(m.mul(W[k][j]));
        }
        // The eliminated entry is exactly zero by construction; assert it.
        W[i][k] = F.ZERO;

        if (opt.recordSteps) {
          res.steps.push({
            type: 'eliminate', stage: k, k, i,
            pivot, aik, m,
            pivotRowBefore: W[k].slice(),
            rowBefore: before,
            rowAfter: W[i].slice(),
            matrix: M.clone(W), L: M.clone(L)
          });
        }
      }
    }

    res.Uhat = M.clone(W);
    res.P = M.permutationMatrix(res.perm);

    /* ================= Phase 2: the D / U split ================= */
    const D = res.D, U = res.U;
    let splitFailedAt = -1;

    for (let k = 0; k < n; k++) {
      const d = W[k][k];
      D[k][k] = d;

      if (d.isZero()) {
        if (res.zeroPivotAt === -1) res.zeroPivotAt = k;

        // D[k][k] = 0 forces row k of D·U to be zero, whatever U is.
        // So the split is only possible when row k of Û is already zero.
        const rowIsZero = W[k].every(v => v.isZero());
        if (rowIsZero) {
          // Any U row works; the unit-triangular convention picks eₖ.
          for (let j = 0; j < n; j++) U[k][j] = (j === k) ? F.ONE : F.ZERO;
          if (opt.recordSteps) {
            res.steps.push({ type: 'split-null', stage: n + k, k, rowIsZero: true });
          }
        } else {
          if (splitFailedAt === -1) splitFailedAt = k;
          for (let j = 0; j < n; j++) U[k][j] = (j === k) ? F.ONE : F.ZERO;
          if (opt.recordSteps) {
            res.steps.push({ type: 'split-null', stage: n + k, k, rowIsZero: false, row: W[k].slice() });
          }
        }
        continue;
      }

      for (let j = 0; j < n; j++) {
        U[k][j] = (j < k) ? F.ZERO : W[k][j].div(d);
      }
      U[k][k] = F.ONE;   // exact by construction

      if (opt.recordSteps) {
        res.steps.push({
          type: 'split', stage: n + k, k, d,
          rowUhat: W[k].slice(), rowU: U[k].slice()
        });
      }
    }

    /* ================= status & messages ================= */
    res.verification = verify(res);

    if (splitFailedAt !== -1) {
      res.status = 'no-ldu';
      res.ok = false;
      say('error',
        `No LDU factorization exists. At stage ${splitFailedAt + 1} the pivot is zero but row ` +
        `${splitFailedAt + 1} of the eliminated matrix is not, so the diagonal cannot be factored ` +
        `out of that row. This happens exactly when A is singular in a way that leaves a gap on ` +
        `the diagonal, rank(A) = ${res.rank} < ${n}. The LU form P·A = L·Û below is still valid.`);
    } else if (res.isSingular) {
      res.status = res.needsPermutation ? 'pldu' : 'ldu';
      res.ok = res.verification.matches;
      say('warn',
        `A is singular (det A = 0, rank ${res.rank} of ${n}). An LDU factorization still exists, ` +
        `but it is not unique : because ${res.zeroPivotAt >= 0 ? `d${subDigits(res.zeroPivotAt + 1)} = 0`: 'some dₖ = 0'}, ` +
        `row ${res.zeroPivotAt + 1} of U can be replaced by any unit-triangular row without breaking the identity.`);
    } else {
      res.status = res.needsPermutation ? 'pldu' : 'ldu';
      res.ok = res.verification.matches;
    }

    if (res.needsPermutation && res.status !== 'no-ldu') {
      const plural = res.swapCount === 1 ? ['swap', 'was'] : ['swaps', 'were'];
      const zeroMinor = firstZeroMinor(res.minors.slice(0, n - 1));
      let why;

      if (opt.pivot === PIVOT.LARGEST && zeroMinor === -1) {
        // The swap was a choice, not a necessity; saying a minor vanished
        // would be false, since none did.
        why = 'No pivot was actually zero: the largest-pivot strategy reorders rows for numerical ' +
          'stability regardless. Switch to “swap only when forced” to get the factorization with P = I.';
      } else if (zeroMinor !== -1) {
        why = `A itself has no plain LDU factorization because leading principal minor ` +
          `D${subDigits(zeroMinor + 1)} = 0.`;
      } else {
        why = 'A pivot vanished part-way through elimination, so a row had to be brought up.';
      }

      say('info',
        `${res.swapCount} row ${plural[0]} ${plural[1]} applied, so the result is the permuted ` +
        `factorization P·A = L·D·U. ${why}`);
    }

    /* ---- symmetric / positive-definite observations ---- */
    if (res.isSymmetric && !res.needsPermutation && res.status !== 'no-ldu') {
      res.isLDLt = M.equals(res.U, M.transpose(res.L));
      if (res.isLDLt) {
        const allPos = Array.from({ length: n }, (_, i) => res.D[i][i]).every(d => d.isPositive());
        res.isSPD = allPos && !res.isSingular;
        say('info',
          res.isSPD
            ? `A is symmetric with every dₖ > 0, so A is positive definite and the factorization ` +
              `is the LDLᵀ form A = L·D·Lᵀ. Taking √dₖ gives the Cholesky factorization A = R·Rᵀ.`
                : `A is symmetric, so U = Lᵀ and the factorization collapses to A = L·D·Lᵀ. ` +
              `Not all dₖ are positive, so A is not positive definite.`);
      }
    }

    if (!res.verification.matches) {
      say('error', 'Internal check failed: the product of the factors does not reproduce A. Please report this matrix as a bug.');
      res.ok = false;
    }

    return res;
  }

  /** Index of the first zero leading principal minor, or -1. */
  function firstZeroMinor(minors) {
    for (let i = 0; i < minors.length; i++) if (minors[i].isZero()) return i;
    return -1;
  }

  /** Exact check : does L·D·U equal P·A? */
  function verify(res) {
    const target = M.mul(res.P || M.identity(res.n), res.A);
    const product = M.mulAll(res.L, res.D, res.U);
    const residual = M.sub(product, target);
    return {
      product,
      target,
      residual,
      matches: M.isZeroMatrix(residual),
      permuted: !!res.needsPermutation
    };
  }

  /** Check the companion identity P·A = L·Û. */
  function verifyLU(res) {
    const target = M.mul(res.P || M.identity(res.n), res.A);
    const product = M.mul(res.L, res.Uhat);
    return { product, target, matches: M.equals(product, target) };
  }

  /* ------------------------------------------------------------
     Solving A·x = b using the factorization
     ------------------------------------------------------------
     P·A·x = P·b  ⇒  L·D·U·x = P·b, solved in three easy passes:
       1. forward substitution   L·y = P·b   (L unit lower)
       2. diagonal scaling       D·z = y     (z_k = y_k / d_k)
       3. back substitution      U·x = z     (U unit upper)
     ------------------------------------------------------------ */
  function solve(res, b) {
    const n = res.n;
    if (b.length !== n) throw new Error(`Right-hand side must have ${n} entries.`);

    const out = {
      ok: false,
      kind: '',            // 'unique' | 'singular-consistent' | 'inconsistent' | 'unavailable'
      b: b.slice(),
      Pb: null, y: null, z: null, x: null,
      steps: { forward: [], diagonal: [], back: [] },
      message: ''
    };

    if (res.status === 'no-ldu') {
      out.kind = 'unavailable';
      out.message = 'No LDU factorization is available for this matrix, so it cannot be used to solve the system.';
      return out;
    }

    // Permute the right-hand side the same way the rows of A were permuted.
    const Pb = res.perm.map(r => b[r]);
    out.Pb = Pb;

    /* --- 1. forward substitution: L·y = P·b --- */
    const y = new Array(n);
    for (let i = 0; i < n; i++) {
      let s = Pb[i];
      const terms = [];
      for (let j = 0; j < i; j++) {
        if (res.L[i][j].isZero()) continue;
        terms.push({ j, l: res.L[i][j], y: y[j] });
        s = s.sub(res.L[i][j].mul(y[j]));
      }
      y[i] = s;                             // L[i][i] = 1, no division needed
      out.steps.forward.push({ i, rhs: Pb[i], terms, value: y[i] });
    }
    out.y = y;

    /* --- 2. diagonal solve: D·z = y --- */
    const z = new Array(n);
    let inconsistent = false;
    let freeVars = [];
    for (let i = 0; i < n; i++) {
      const d = res.D[i][i];
      if (d.isZero()) {
        if (!y[i].isZero()) {
          inconsistent = true;
          out.steps.diagonal.push({ i, d, y: y[i], value: null, conflict: true });
          z[i] = F.ZERO;
        } else {
          // 0·z_i = 0, z_i is free; pick 0 for a particular solution.
          freeVars.push(i);
          z[i] = F.ZERO;
          out.steps.diagonal.push({ i, d, y: y[i], value: z[i], free: true });
        }
      } else {
        z[i] = y[i].div(d);
        out.steps.diagonal.push({ i, d, y: y[i], value: z[i] });
      }
    }
    out.z = z;

    if (inconsistent) {
      out.kind = 'inconsistent';
      out.message = 'The system has no solution: elimination produces a row of the form 0 = (non-zero).';
      return out;
    }

    /* --- 3. back substitution: U·x = z --- */
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = z[i];
      const terms = [];
      for (let j = i + 1; j < n; j++) {
        if (res.U[i][j].isZero()) continue;
        terms.push({ j, u: res.U[i][j], x: x[j] });
        s = s.sub(res.U[i][j].mul(x[j]));
      }
      x[i] = s;                             // U[i][i] = 1
      out.steps.back.push({ i, rhs: z[i], terms, value: x[i] });
    }
    out.steps.back.reverse();
    out.x = x;

    // Confirm the answer against the original matrix, exactly.
    const check = M.mulVec(res.A, x);
    const exact = check.every((v, i) => v.eq(b[i]));

    if (freeVars.length) {
      out.kind = 'singular-consistent';
      out.ok = exact;
      out.message = `The system is consistent but under-determined: ${freeVars.length} free ` +
        `variable${freeVars.length === 1 ? '' : 's'}, so there are infinitely many solutions. ` +
        `Shown below is one particular solution (free components set to 0).`;
    } else {
      out.kind = 'unique';
      out.ok = exact;
      out.message = 'Unique solution.';
    }
    out.residualOk = exact;
    out.check = check;
    return out;
  }

  /**
   * Inverse of A, computed by solving A·xⱼ = eⱼ once per column
   * through the same factorization.
   */
  function inverse(res) {
    const n = res.n;
    if (res.isSingular || res.status === 'no-ldu') {
      return { ok: false, matrix: null, message: 'A is singular (det A = 0), so it has no inverse.' };
    }
    const cols = [];
    for (let j = 0; j < n; j++) {
      const e = Array.from({ length : n }, (_, i) => (i === j ? F.ONE : F.ZERO));
      const s = solve(res, e);
      if (!s.ok) return { ok: false, matrix: null, message: 'Could not solve for column ' + (j + 1) + '.' };
      cols.push(s.x);
    }
    const inv = M.transpose(cols);
    const check = M.equals(M.mul(res.A, inv), M.identity(n));
    return { ok : check, matrix : inv, message : check ? 'A·A⁻¹ = I verified exactly.' : 'Verification failed.' };
  }

  /**
   * Cholesky-style factors for a symmetric positive-definite A:
   * from A = L·D·Lᵀ we get A = R·Rᵀ with R = L·√D. √dₖ is
   * irrational in general, so it is returned as a decimal string
   * alongside the exact dₖ.
   */
  function choleskyFromLDL(res) {
    if (!res.isLDLt || !res.isSPD) return { ok: false, rows: null };
    const n = res.n;
    const sqrtD = [];
    for (let k = 0; k < n; k++) sqrtD.push(Math.sqrt(res.D[k][k].toNumber()));
    const R = [];
    for (let i = 0; i < n; i++) {
      R.push([]);
      for (let j = 0; j < n; j++) R[i].push(j <= i ? res.L[i][j].toNumber() * sqrtD[j] : 0);
    }
    return { ok: true, R, sqrtD };
  }

  /**
   * The elementary-matrix view: P·A = L·Û means
   * A = P⁻¹·E₁⁻¹·E₂⁻¹ ⋯ ·Û. Returns the unit lower-triangular
   * elementary matrices Eₖ actually applied, for the theory page.
   */
  function elementaryMatrices(res) {
    const n = res.n, out = [];
    for (let k = 0; k < n - 1; k++) {
      const E = M.identity(n);
      let any = false;
      for (let i = k + 1; i < n; i++) {
        if (!res.L[i][k].isZero()) { E[i][k] = res.L[i][k].neg(); any = true; }
      }
      if (any) out.push({ k, E });
    }
    return out;
  }

  global.LDU = {
    PIVOT,
    factorize,
    verify,
    verifyLU,
    solve,
    inverse,
    choleskyFromLDL,
    elementaryMatrices,
    firstZeroMinor
  };

  /* small text helpers reused in messages */
  function subDigits(k) {
    const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
    return String(k).replace(/\d/g, d => map[d]);
  }
  function sub(name, i, j) { return `${name}${subDigits(i)}${subDigits(j)}`; }
})(typeof window !== 'undefined' ? window : globalThis);
