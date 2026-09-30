# DecomposeX

An interactive guide to LDU matrix factorization. It teaches the theory, derives the algorithm, and
factors matrices **exactly**, using arbitrary-precision fractions instead of floating point.

**Live demo: [decomposex.priyadarshi.top](https://decomposex.priyadarshi.top)**

## Key features

- **Exact arithmetic.** Every value is a fraction of arbitrary-precision integers, so a pivot that is
  mathematically zero tests as exactly zero, and `1/3` stays `1/3`.
- **Handles the cases that break naive implementations.** Detects zero pivots, swaps rows and reports
  `P·A = L·D·U`, and explains clearly when no factorization exists instead of returning `NaN`.
- **Shows its working.** Every elimination stage, multiplier and row operation, in two phases.
- **Self-verifying.** Multiplies the factors back and compares against `A` entry by entry.
- **Full diagnostics.** Determinant, rank, leading principal minors, symmetry, definiteness, Cholesky.
- **Solves systems.** `A·x = b` by substitution, distinguishing unique, inconsistent and
  under-determined cases. Also computes the inverse.
- **8 pages** of theory, worked examples, applications and generated practice questions.

## Tech stack

Vanilla HTML, CSS and JavaScript.

## Run locally

```bash
git clone https://github.com/iPriyadarshi/DecomposeX.git
cd DecomposeX
```

Then open `index.html`:

```bash
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

## Project structure

```
*.html            one file per page, plus a 404 page
css/main.css      design system: tokens, components, light and dark themes
js/fraction.js    exact rational arithmetic on BigInt
js/matrix.js      matrix algebra, determinant, rank, parsing
js/ldu.js         the factorization, solving, inversion  (no DOM access)
js/render.js      renders matrices and steps to the DOM
js/site.js        navigation, footer, theme, icon set
js/<page>.js      the interactive parts of one page
```

## Technical decisions

**Exact fractions instead of floats.** Elimination subtracts nearly equal numbers, which destroys
precision. A pivot that should be zero typically comes out as `4.9e-17`, so the test for a zero pivot
silently fails and the algorithm divides by almost nothing. Storing every value as a reduced
`BigInt` ratio makes that test reliable, and means a singular matrix reports `det = 0` rather than
`1.9e-16`.

**Two-phase factorization.** Gaussian elimination produces `P·A = L·Û` first; `Û` is then split into
`D` and `U` by dividing each row by its own pivot. Separating the phases is what makes the failure
cases explainable: a zero pivot next to a non-empty row is exactly where LDU stops existing, while
`LU` still does.

**Truncated decimals, not rounded.** Displayed decimals truncate with a trailing `…` so every digit
shown is a true digit. Rounding would print `9999/10000` as `1` at three places, which reads as an
exact value it is not. Exports round properly instead, since a `…` would not paste anywhere useful.

## Documentation

The site documents itself: [`theory.html`](theory.html) covers the mathematics with proofs,
[`algorithm.html`](algorithm.html) has the pseudocode and complexity, and
[`about.html`](about.html) explains how the project is built.

## License

[MIT](LICENSE)
