/* ============================================================
   about.js, icons and the table of contents for the About page
   ============================================================ */
(function () {
  'use strict';
  const S = window.Site;

  function start() {
    document.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      if (S.ICONS[name]) el.appendChild(S.icon(S.ICONS[name]));
    });
    S.buildToc('.prose', '#toc-host');
  }

  S.ready(start);
})();
