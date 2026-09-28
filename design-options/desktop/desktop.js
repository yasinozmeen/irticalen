// Taslak durumu: ?s=idle | landed | first  (her öğe data-state="idle landed" gibi hangi durumlarda göründüğünü söyler)
(() => {
  const params = new URLSearchParams(location.search);
  const s = params.get('s') || 'idle';
  document.querySelectorAll('[data-state]').forEach((el) => {
    el.hidden = !el.dataset.state.split(' ').includes(s);
  });

  // ?check → sayfa kaydırıyor mu, konu satırı ya da tek satırlık öğe sütunundan taşıyor mu?
  if (!params.has('check')) return;
  const run = () => {
    const problems = [];
    const sh = document.documentElement.scrollHeight;
    if (sh > innerHeight) problems.push(`dikey kaydırma ${sh}>${innerHeight}`);
    const sw = document.documentElement.scrollWidth;
    if (sw > innerWidth) problems.push(`yatay kaydırma ${sw}>${innerWidth}`);
    document.querySelectorAll('.topic-line, .index-list a, .today-topic, .plan-steps li, .dock-link').forEach((el) => {
      if (el.offsetParent === null) return;
      const col = el.closest('.topic-stage, .page-left, .margin-col, .main-col, .page-right, .dock, .app-shell');
      if (!col) return;
      const r = el.getBoundingClientRect();
      const c = col.getBoundingClientRect();
      if (r.right > c.right + 1) problems.push(`taşma: "${el.textContent.trim()}" +${Math.round(r.right - c.right)}px`);
    });
    const dock = document.querySelector('.dock');
    if (dock) {
      const top = dock.getBoundingClientRect().top;
      document.querySelectorAll('.app-shell *').forEach((el) => {
        if (el.offsetParent === null || el.closest('.settings-backdrop')) return;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > top + 1 && r.top < innerHeight) problems.push(`çubuğun altına giriyor: ${el.className || el.tagName}`);
      });
    }
    const div = document.createElement('div');
    div.className = 'check-badge';
    div.style.background = problems.length ? '#b8281c' : '#2e6b2e';
    div.textContent = problems.length ? [...new Set(problems)].slice(0, 6).join(' | ') : `temiz ${innerWidth}×${innerHeight}`;
    document.body.appendChild(div);
    document.title = (problems.length ? 'FAIL ' + div.textContent : 'OK') + ' @' + innerWidth + 'x' + innerHeight;
  };
  document.fonts.ready.then(() => setTimeout(run, 300));
})();
