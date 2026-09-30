/* ============================================================
   fraction.js, exact rational arithmetic on BigInt
   ------------------------------------------------------------
   Every number in DecomposeX flows through this type. Using
   exact rationals instead of IEEE-754 doubles means the whole
   factorization is computed without a single rounding error,
   so results like 1/3 stay 1/3 instead of 0.3333333333333333,
   and a pivot that is mathematically zero tests as exactly
   zero rather than 4.9e-17.

   Invariants held by every Fraction instance:
     - den > 0n                (sign lives entirely in num)
     - gcd(|num|, den) === 1n  (always in lowest terms)
   ============================================================ */
(function (global) {
  'use strict';

  /** Greatest common divisor of two non-negative BigInts. */
  function gcd(a, b) {
    while (b) { const t = a % b; a = b; b = t; }
    return a < 0n ? -a : a;
  }

  function abs(x) { return x < 0n ? -x : x; }

  class Fraction {
    /**
     * @param {bigint|number|string} num
     * @param {bigint|number} [den=1n]
     */
    constructor(num, den = 1n) {
      let n = typeof num === 'bigint' ? num : BigInt(num);
      let d = typeof den === 'bigint' ? den : BigInt(den);

      if (d === 0n) throw new RangeError('Fraction: zero denominator');

      // Normalise sign onto the numerator.
      if (d < 0n) { n = -n; d = -d; }

      // Reduce to lowest terms.
      const g = gcd(abs(n), d);
      if (g > 1n) { n /= g; d /= g; }

      this.n = n;
      this.d = d;
      Object.freeze(this);
    }

    /* ---------- construction ---------- */

    /**
     * Parse user input into an exact Fraction.
     * Accepts: "3", "-4", "2/3", "-7/8", "0.25", "-1.5", "1e3",
     *          "2.5e-2", ".5", "+3", "5/-2", and unicode minus.
     * Returns null when the text is not a valid number.
     */
    static parse(text) {
      if (text === null || text === undefined) return null;
      if (text instanceof Fraction) return text;
      if (typeof text === 'bigint') return new Fraction(text);

      let s = String(text).trim()
.replace(/[−‒–, ]/g, '-')  // unicode dashes → '-'
.replace(/[\s,_]/g, '');                      // strip spaces & separators

      if (s === '') return null;

      // Rational form  a/b
      const slash = s.indexOf('/');
      if (slash !== -1) {
        const a = Fraction.parse(s.slice(0, slash));
        const b = Fraction.parse(s.slice(slash + 1));
        if (!a || !b || b.isZero()) return null;
        return a.div(b);
      }

      // Decimal / scientific form
      const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
      if (!m) return null;

      const [, sign, intPart, fracPart, expPart] = m;
      if (!intPart && !fracPart) return null;   // rejects "", ".", "e5", "-"

      const digits = (intPart || '0') + (fracPart || '');
      let num = BigInt(digits);
      let den = 10n ** BigInt((fracPart || '').length);

      if (expPart) {
        const e = BigInt(expPart);
        if (e > 0n) num *= 10n ** e;
        else if (e < 0n) den *= 10n ** -e;
      }

      if (sign === '-') num = -num;
      return new Fraction(num, den);
    }

    /** Coerce a number | bigint | string | Fraction into a Fraction (throws on bad input). */
    static from(v) {
      if (v instanceof Fraction) return v;
      const f = Fraction.parse(v);
      if (!f) throw new TypeError('Fraction.from: cannot convert ' + JSON.stringify(v));
      return f;
    }

    static get ZERO() { return F0; }
    static get ONE() { return F1; }

    /* ---------- arithmetic ---------- */

    add(o) { o = Fraction.from(o); return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Fraction.from(o); return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Fraction.from(o); return new Fraction(this.n * o.n, this.d * o.d); }

    div(o) {
      o = Fraction.from(o);
      if (o.isZero()) throw new RangeError('Fraction: division by zero');
      return new Fraction(this.n * o.d, this.d * o.n);
    }

    neg() { return new Fraction(-this.n, this.d); }
    abs() { return this.n < 0n ? this.neg() : this; }

    inv() {
      if (this.isZero()) throw new RangeError('Fraction: cannot invert zero');
      return new Fraction(this.d, this.n);
    }

    /* ---------- comparison ---------- */

    isZero() { return this.n === 0n; }
    isOne() { return this.n === 1n && this.d === 1n; }
    isNegative() { return this.n < 0n; }
    isPositive() { return this.n > 0n; }
    isInteger() { return this.d === 1n; }

    /** -1 | 0 | 1 */
    cmp(o) {
      o = Fraction.from(o);
      const l = this.n * o.d, r = o.n * this.d;
      return l < r ? -1 : l > r ? 1 : 0;
    }

    eq(o) { return this.cmp(o) === 0; }
    lt(o) { return this.cmp(o) < 0; }
    gt(o) { return this.cmp(o) > 0; }

    /** +1 | 0 | -1 */
    sign() { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }

    /* ---------- output ---------- */

    /** Exact fraction text: "3", "-2/5". */
    toFractionString() {
      return this.d === 1n ? this.n.toString(): `${this.n}/${this.d}`;
    }

    /**
     * Decimal text for display.
     *
     * Terminating decimals print exactly. Non-terminating ones are
     * TRUNCATED at `places` digits and marked with a trailing "…",
     * never rounded: rounding would let 9999/10000 display as "1"
     * at three places, which reads as an exact value it is not.
     * Truncation keeps every printed digit a true digit of the number.
     * Use toFixed() when a properly rounded decimal is wanted.
     */
    toDecimalString(places = 6) {
      if (this.d === 1n) return this.n.toString();

      const neg = this.n < 0n;
      const num = abs(this.n);
      const den = this.d;

      const whole = num / den;
      let rem = num % den;
      if (rem === 0n) return (neg ? '-' : '') + whole.toString();

      // Long division, one digit at a time.
      let digits = '';
      let exact = false;
      for (let i = 0; i < places; i++) {
        rem *= 10n;
        digits += (rem / den).toString();
        rem %= den;
        if (rem === 0n) { exact = true; break; }
      }

      let out = whole.toString() + '.' + digits;
      if (exact) out = out.replace(/0+$/, '').replace(/\.$/, '');
      else out += '…';

      return (neg ? '-' : '') + out;
    }

    /**
     * Properly rounded fixed-point decimal (half away from zero),
     * always `places` digits after the point. For export and copying.
     */
    toFixed(places = 6) {
      const neg = this.n < 0n;
      const num = abs(this.n);
      const den = this.d;
      const scale = 10n ** BigInt(places);

      // round(num/den * scale) with half away from zero
      const scaled = num * scale;
      let q = scaled / den;
      const rem2 = (scaled % den) * 2n;
      if (rem2 >= den) q += 1n;

      let s = q.toString().padStart(places + 1, '0');
      const out = places === 0 ? s : s.slice(0, s.length - places) + '.' + s.slice(s.length - places);
      return (neg && q !== 0n ? '-' : '') + out;
    }

    /** Default display honours a global preference; see format(). */
    toString() { return this.toFractionString(); }

    /** LaTeX: \frac{a}{b} or a. */
    toLatex() {
      if (this.d === 1n) return this.n.toString();
      return (this.n < 0n ? '-' : '') + `\\frac{${abs(this.n)}}{${this.d}}`;
    }

    /**
     * Lossy conversion. Deliberately explicit; there is no valueOf(),
     * so `"" + f` yields "3/2" rather than silently decaying to 1.5.
     */
    toNumber() { return Number(this.n) / Number(this.d); }
  }

  const F0 = new Fraction(0n);
  const F1 = new Fraction(1n);

  /* ---------- helpers ---------- */

  /**
   * Format a Fraction for display.
   * `round: true` produces a properly rounded fixed-point decimal with no
   * truncation marker, use it for exports, where a trailing "…" would make
   * the value unusable in another tool.
   * @param {Fraction} f
   * @param {{mode?:'fraction'|'decimal', places?:number, round?:boolean}} opts
   */
  function format(f, opts) {
    const o = opts || {};
    if (o.mode !== 'decimal') return f.toFractionString();
    const places = o.places == null ? 6 : o.places;
    return o.round ? f.toFixed(places) : f.toDecimalString(places);
  }

  global.Fraction = Fraction;
  global.FractionUtil = { gcd, format };
})(typeof window !== 'undefined' ? window : globalThis);
