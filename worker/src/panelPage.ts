// The owner's notebook page, served by the Worker at /api/panel. Design: design-options/panel/index.html.
// Kept as a plain string (no backticks or ${ inside) so the Worker needs no build step for it.
export const PANEL_HTML = String.raw`<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>irticalen defteri</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&display=swap" rel="stylesheet">
<style>
  :root {
    --paper: #f3eee2;
    --ink: #1d1a16;
    --pencil: #6f695c;
    --rule: #d6cfbf;
    --red: #b8281c;
    --paper-tex: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='389' height='389'%3E%3Cfilter id='d' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='4' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .33 0 0 0 0 .28 0 0 0 0 .2 3.2 0 0 0 -1.45'/%3E%3C/filter%3E%3Crect width='389' height='389' filter='url%28%23d%29' opacity='.34'/%3E%3C/svg%3E"),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='557' height='557'%3E%3Cfilter id='l' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='17' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 .97 3 0 0 0 -1.5'/%3E%3C/filter%3E%3Crect width='557' height='557' filter='url%28%23l%29' opacity='.55'/%3E%3C/svg%3E");
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background: var(--paper-tex), var(--paper);
    color: var(--ink);
    font-family: 'Newsreader', Georgia, serif;
    font-size: 1.0625rem;
    line-height: 1.5;
    font-optical-sizing: auto;
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: contain;
  }
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
  h1, h2, h3, p, ol, ul { margin: 0; padding: 0; }
  ol, ul { list-style: none; }
  :focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }

  .page { max-width: 34rem; margin: 0 auto; padding: 1.25rem 1.25rem calc(4rem + env(safe-area-inset-bottom)); }

  /* Başlık satırı: defterin adı solda, dönem seçimi sağda — ikisi de yazı */
  .masthead { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-bottom: .75rem; border-bottom: 1px solid var(--rule); }
  .masthead h1 { font-size: 1.0625rem; font-weight: 600; letter-spacing: .005em; }
  .masthead h1 .dot { color: var(--red); }
  .tabs { display: flex; gap: 1.25rem; }
  .tab {
    color: var(--pencil); text-decoration: underline; text-decoration-color: var(--rule);
    text-underline-offset: .3em; text-decoration-thickness: 1px; padding: .5rem 0; min-height: 44px;
  }
  .tab[aria-selected="true"] { color: var(--ink); font-weight: 600; text-decoration-color: var(--ink); text-decoration-thickness: 2px; }
  .tab .count { font-variant-numeric: tabular-nums; }

  .range { display: flex; gap: 1rem; margin-top: 1.25rem; font-size: .9375rem; }
  .range button { color: var(--pencil); text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: .3em; min-height: 44px; }
  .range button[aria-pressed="true"] { color: var(--ink); font-weight: 600; text-decoration-color: var(--ink); text-decoration-thickness: 2px; }

  /* Açılış: sayılar cümlenin içinde */
  .lede { font-size: clamp(1.625rem, 6.2vw, 2.125rem); line-height: 1.22; font-weight: 400; letter-spacing: -.01em; margin-top: 1rem; text-wrap: pretty; }
  .lede b { font-weight: 600; font-variant-numeric: lining-nums tabular-nums; }
  .lede-note { color: var(--pencil); font-size: .9375rem; margin-top: .75rem; }

  section { margin-top: 2.75rem; }
  h2 { font-size: 1.0625rem; font-weight: 600; margin-bottom: 1rem; }
  h2 small { font-weight: 400; color: var(--pencil); font-size: .9375rem; margin-left: .35rem; }

  /* Huni: mürekkep cetvel — çizgi uzunluğu = o adıma gelen kişi */
  .funnel li { display: grid; grid-template-columns: 1fr auto; column-gap: 1rem; align-items: baseline; padding: .55rem 0 .7rem; }
  .funnel .label { font-size: 1rem; }
  .funnel .n { font-variant-numeric: tabular-nums; font-weight: 600; }
  .funnel .pct { color: var(--pencil); font-weight: 400; font-size: .875rem; margin-left: .4rem; }
  .funnel .bar { grid-column: 1 / -1; height: 3px; background: var(--rule); margin-top: .45rem; position: relative; }
  .funnel .bar i { position: absolute; inset: 0 auto 0 0; background: var(--ink); width: var(--w); transform-origin: left; animation: draw .9s cubic-bezier(.2,.7,.2,1) both; animation-delay: var(--d, 0s); }
  .funnel .drop { grid-column: 1 / -1; color: var(--red); font-size: .875rem; margin-top: .35rem; }
  .funnel .drop::before { content: ''; display: inline-block; width: .4rem; height: .4rem; background: var(--red); border-radius: 50%; margin-right: .45rem; vertical-align: .12em; }
  @keyframes draw { from { transform: scaleX(0); } }

  /* Günler: çetele gibi ince dikey çizgiler */
  .days { display: grid; grid-template-columns: repeat(14, 1fr); gap: .35rem; align-items: end; height: 5.5rem; border-bottom: 1px solid var(--ink); }
  .days span { background: var(--ink); height: var(--h); min-height: 1px; width: 3px; justify-self: center; }
  .days span.today { background: var(--red); }
  .days-axis { display: flex; justify-content: space-between; color: var(--pencil); font-size: .8125rem; margin-top: .4rem; }

  /* İki sütunlu küçük tablolar: nereden, cihaz, ülke */
  .ledger { width: 100%; border-collapse: collapse; font-size: 1rem; }
  .ledger td { padding: .5rem 0; border-bottom: 1px solid var(--rule); }
  .ledger td:last-child { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .ledger td.muted { color: var(--pencil); font-weight: 400; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1.75rem; }
  .pair h3 { font-size: .9375rem; font-weight: 600; margin-bottom: .25rem; }

  .quiet { color: var(--pencil); font-size: .9375rem; }

  /* Mesajlar */
  .filters { display: flex; flex-wrap: wrap; column-gap: 1rem; margin-top: 1.25rem; font-size: .9375rem; }
  .filters button { color: var(--pencil); text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: .3em; min-height: 44px; }
  .filters button[aria-pressed="true"] { color: var(--ink); font-weight: 600; text-decoration-color: var(--ink); text-decoration-thickness: 2px; }

  .notes { margin-top: .5rem; }
  .note { padding: 1.1rem 0 1rem; border-bottom: 1px solid var(--rule); }
  .note-head { display: flex; justify-content: space-between; gap: 1rem; color: var(--pencil); font-size: .875rem; }
  .note-kind.mine { color: var(--red); }
  .note-kind.mine::before { content: ''; display: inline-block; width: .4rem; height: .4rem; background: var(--red); border-radius: 50%; margin-right: .45rem; vertical-align: .12em; }
  .note-text { font-size: 1.1875rem; line-height: 1.42; margin-top: .35rem; text-wrap: pretty; }
  .note-foot { display: flex; gap: 1.25rem; margin-top: .5rem; font-size: .9375rem; }
  .note-foot button { color: var(--pencil); text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: .3em; min-height: 36px; }
  .note.done .note-text { color: var(--pencil); text-decoration: line-through; text-decoration-color: var(--pencil); text-decoration-thickness: 1px; }
  .note.done .mark { color: var(--ink); text-decoration-color: var(--ink); }

  [hidden] { display: none !important; }
  @media (prefers-reduced-motion: reduce) { .funnel .bar i { animation: none; } }
  @media (min-width: 40rem) { .page { padding-top: 2.5rem; } }
  .status { margin-top: 2rem; color: var(--pencil); }
  .note-contact { color: var(--pencil); font-size: .9375rem; margin-top: .25rem; overflow-wrap: anywhere; }
  .note-text { overflow-wrap: anywhere; white-space: pre-line; }
  .note-more { color: var(--ink); font-size: 1rem; line-height: 1.55; margin-top: .6rem; white-space: pre-line; overflow-wrap: anywhere; }
  .note-foot .more { color: var(--ink); }
  .empty { margin-top: 1.5rem; }
  .flash {
    position: fixed; left: 50%; bottom: calc(1rem + env(safe-area-inset-bottom)); transform: translate(-50%, 1.5rem);
    display: flex; gap: 1.25rem; align-items: baseline; padding: .7rem 1.1rem; background: var(--ink); color: var(--paper);
    font-size: .9375rem; opacity: 0; pointer-events: none; transition: opacity .2s, transform .25s cubic-bezier(.2,.7,.2,1);
    max-width: calc(100% - 2rem);
  }
  .flash.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
  .flash button { color: var(--paper); text-decoration: underline; text-underline-offset: .3em; min-height: 32px; }
  @media (prefers-reduced-motion: reduce) { .flash { transition: none; } }
</style>

</head>
<body>
<main class="page">
  <header class="masthead">
    <h1>irticalen<span class="dot">.</span> defteri</h1>
    <nav class="tabs" role="tablist" aria-label="Bölümler">
      <button class="tab" role="tab" aria-selected="true" aria-controls="p-stats" id="t-stats">sayılar</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="p-notes" id="t-notes">mesajlar <span class="count" id="note-count"></span></button>
    </nav>
  </header>

  <p class="status" id="status" role="status">defter açılıyor…</p>

  <div id="p-stats" role="tabpanel" aria-labelledby="t-stats" hidden>
    <div class="range" role="group" aria-label="Dönem" id="range">
      <button data-range="today" aria-pressed="false">bugün</button>
      <button data-range="7" aria-pressed="true">7 gün</button>
      <button data-range="30" aria-pressed="false">30 gün</button>
      <button data-range="all" aria-pressed="false">hepsi</button>
    </div>

    <p class="lede" id="lede"></p>
    <p class="lede-note" id="lede-note"></p>

    <section aria-labelledby="h-funnel">
      <h2 id="h-funnel">Nerede bırakıyorlar</h2>
      <ol class="funnel" id="funnel"></ol>
      <p class="quiet" id="funnel-note"></p>
    </section>

    <section aria-labelledby="h-days">
      <h2 id="h-days">Günlere göre <small>gelen kişi, son 14 gün</small></h2>
      <div class="days" id="days" aria-hidden="true"></div>
      <div class="days-axis" id="days-axis"></div>
    </section>

    <section aria-labelledby="h-where">
      <h2 id="h-where">Nereden geldiler</h2>
      <table class="ledger" id="refs"></table>
    </section>

    <section class="pair" aria-label="Cihaz ve ülke">
      <div>
        <h3>Cihaz</h3>
        <table class="ledger" id="devices"></table>
      </div>
      <div>
        <h3>Ülke</h3>
        <table class="ledger" id="countries"></table>
      </div>
    </section>

    <section aria-labelledby="h-more">
      <h2 id="h-more">Başka hareketler</h2>
      <table class="ledger" id="more"></table>
    </section>
  </div>

  <div id="p-notes" role="tabpanel" aria-labelledby="t-notes" hidden>
    <div class="filters" role="group" aria-label="Süzgeç" id="filters">
      <button data-filter="all" aria-pressed="true">hepsi</button>
      <button data-filter="idea" aria-pressed="false">fikirlerim</button>
      <button data-filter="topic" aria-pressed="false">konu</button>
      <button data-filter="problem" aria-pressed="false">sorun</button>
      <button data-filter="done" aria-pressed="false">yapılanlar</button>
    </div>
    <ol class="notes" id="notes"></ol>
    <p class="quiet empty" id="notes-empty" hidden></p>
  </div>
</main>
<script>
(function () {
  'use strict';

  // Telegram hands its signed launch data to a Mini App in the address hash; no Telegram script is loaded.
  var init = '';
  try {
    init = new URLSearchParams(location.hash.slice(1)).get('tgWebAppData') || sessionStorage.getItem('tg-init') || '';
    if (init) sessionStorage.setItem('tg-init', init);
  } catch (e) {
    init = new URLSearchParams(location.hash.slice(1)).get('tgWebAppData') || '';
  }

  function tg(eventType, eventData) {
    var data = JSON.stringify(eventData || {});
    try {
      if (window.TelegramWebviewProxy) window.TelegramWebviewProxy.postEvent(eventType, data);
      else if (window.external && 'notify' in window.external) window.external.notify(JSON.stringify({ eventType: eventType, eventData: eventData || {} }));
    } catch (e) { /* outside Telegram: nothing to tell */ }
  }
  tg('web_app_set_header_color', { color: '#f3eee2' });
  tg('web_app_set_background_color', { color: '#f3eee2' });
  tg('web_app_ready');
  tg('web_app_expand');

  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status');
  var state = { range: '7', filter: 'all', data: null };

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') node.setAttribute('style', attrs[k]);
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  // Turkish possessive suffix after a number, as it is read aloud: 17'si, 9'u, 6'sı, 3'ü, 40'ı, 100'ü.
  function iyelik(n) {
    var ones = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
    var tens = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'];
    if (n === 0) return "'ı";
    if (n % 10) return "'" + ones[n % 10];
    if (n % 100) return "'" + tens[(n % 100) / 10];
    if (n % 1000) return "'ü";
    return "'i";
  }

  var TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var TR_OFFSET = 3 * 3600 * 1000;
  function trDate(ms) { return new Date(ms + TR_OFFSET); }
  function dayKey(ms) { return trDate(ms).toISOString().slice(0, 10); }
  function dayLabel(key) { var p = key.split('-'); return Number(p[2]) + ' ' + TR_MONTHS[Number(p[1]) - 1]; }
  function when(ms, now) {
    var d = trDate(ms);
    var hm = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    var today = dayKey(now);
    var yesterday = dayKey(now - 86400000);
    var key = dayKey(ms);
    if (key === today) return 'bugün ' + hm;
    if (key === yesterday) return 'dün ' + hm;
    return dayLabel(key) + ' ' + hm;
  }

  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(['tr'], { type: 'region' }); } catch (e) { /* old webview: codes */ }
  function country(code) {
    if (!code) return 'bilinmiyor';
    if (SHORT_COUNTRIES[code]) return SHORT_COUNTRIES[code];
    try { return (regionNames && regionNames.of(code)) || code; } catch (e) { return code; }
  }
  var SHORT_COUNTRIES = { US: 'ABD', GB: 'İngiltere', AE: 'BAE' };
  var DEVICES = { mobile: 'telefon', desktop: 'bilgisayar' };
  var KINDS = { idea: 'senin fikrin', topic: 'konu önerisi', problem: 'sorun bildirimi', other: 'başka' };

  function rows(table, list, labelOf, valueOf) {
    table.replaceChildren();
    if (!list.length) {
      var tr0 = el('tr');
      tr0.append(el('td', { class: 'muted' }, 'henüz yok'), el('td'));
      table.append(tr0);
      return;
    }
    list.forEach(function (item) {
      var tr = el('tr');
      tr.append(el('td', null, labelOf(item)), el('td', null, valueOf(item)));
      table.append(tr);
    });
  }

  function renderStats(d) {
    var ev = d.events;
    var v = ev.page_view || 0, spin = ev.spin || 0, start = ev.start_speech || 0, done = ev.speech_done || 0;
    var period = { today: 'Bugün', '7': 'Son 7 günde', '30': 'Son 30 günde', all: 'Şimdiye kadar' }[d.range];

    var lede = $('lede');
    lede.replaceChildren();
    if (!v) {
      lede.textContent = d.range === 'today' ? 'Bugün henüz kimse gelmedi.' : period + ' kimse gelmedi.';
    } else {
      var parts = [period + ' ', ['b', v], ' kişi geldi. '];
      parts.push(['b', spin], iyelik(spin) + ' çarkı çevirdi, ', ['b', start], iyelik(start) + ' konuşmaya başladı, ',
        ['b', done], iyelik(done) + ' sonuna kadar konuştu.');
      parts.forEach(function (p) { lede.append(typeof p === 'string' ? p : el('b', null, p[1])); });
    }

    var note = '';
    if (d.previousVisitors !== null) {
      var prevName = { today: 'Dün', '7': 'Önceki 7 günde', '30': 'Önceki 30 günde' }[d.range];
      note = d.previousVisitors ? prevName + ' ' + d.previousVisitors + ' kişi gelmişti.' : prevName + ' kimse gelmemişti.';
    }
    $('lede-note').textContent = note;

    var steps = [
      { label: 'siteyi açtı', n: v },
      { label: 'çarkı çevirdi', n: spin, lost: 'kişi çarkı hiç çevirmeden çıktı' },
      { label: 'konuşmaya başladı', n: start, lost: 'kişi çarkı çevirdi ama konuşmaya başlamadı' },
      { label: 'sonuna kadar konuştu', n: done, lost: 'kişi konuşmaya başladı ama bitirmedi' }
    ];
    var worst = -1, worstLoss = 0;
    for (var i = 1; i < steps.length; i++) {
      var loss = steps[i - 1].n - steps[i].n;
      if (loss > worstLoss) { worstLoss = loss; worst = i; }
    }
    var funnel = $('funnel');
    funnel.replaceChildren();
    steps.forEach(function (s, i) {
      var li = el('li');
      var n = el('span', { class: 'n' }, s.n);
      if (i > 0 && steps[i - 1].n) n.append(el('span', { class: 'pct' }, '%' + Math.round((s.n / steps[i - 1].n) * 100)));
      var bar = el('span', { class: 'bar' });
      bar.append(el('i', { style: '--w:' + (v ? (s.n / v) * 100 : 0) + '%;--d:' + i * 0.08 + 's' }));
      li.append(el('span', { class: 'label' }, s.label), n, bar);
      if (i === worst) li.append(el('span', { class: 'drop' }, 'en büyük kayıp burada: ' + worstLoss + ' ' + s.lost));
      funnel.append(li);
    });
    var fn = 'Yüzdeler bir önceki adıma göre.';
    if (d.closeEarly.count) {
      fn += ' ' + d.closeEarly.count + ' kişi süre bitmeden kapattı';
      fn += d.closeEarly.avgLeft !== null ? '; ortalama ' + Math.round(d.closeEarly.avgLeft) + ' saniye kalmıştı.' : '.';
    }
    $('funnel-note').textContent = fn;

    // Last 14 days, one ink stroke per day; today in red.
    var byDay = {};
    d.days.forEach(function (r) { byDay[r.day] = r.sessions; });
    var keys = [];
    for (var k = 13; k >= 0; k--) keys.push(dayKey(d.now - k * 86400000));
    var max = Math.max.apply(null, keys.map(function (key) { return byDay[key] || 0; }).concat([1]));
    var days = $('days');
    days.replaceChildren();
    var peak = keys[0];
    keys.forEach(function (key, idx) {
      var c = byDay[key] || 0;
      if (c > (byDay[peak] || 0)) peak = key;
      days.append(el('span', { class: idx === 13 ? 'today' : '', style: '--h:' + (c / max) * 100 + '%' }));
    });
    var axis = $('days-axis');
    axis.replaceChildren(el('span', null, dayLabel(keys[0])));
    if (byDay[peak] && peak !== keys[13]) axis.append(el('span', null, 'en çok ' + dayLabel(peak) + ': ' + byDay[peak]));
    axis.append(el('span', null, 'bugün: ' + (byDay[keys[13]] || 0)));

    rows($('refs'), d.refs, function (r) { return r.label ? r.label.replace(/^www\./, '') : 'doğrudan adres'; }, function (r) { return r.sessions; });
    rows($('devices'), d.devices, function (r) { return DEVICES[r.label] || 'bilinmiyor'; }, function (r) { return r.sessions; });
    rows($('countries'), d.countries, function (r) { return country(r.label); }, function (r) { return r.sessions; });

    var more = [
      ["paylaş'a bastı", ev.share_click],
      ['"bize yaz"ı açtı', ev.feedback_open],
      ['mesaj gönderdi', ev.feedback_sent],
      ['modu değiştirdi', ev.mode_change],
      ['araştırmaya başladı', ev.start_research],
      ['"irticalen ne demek?"i okudu', ev.sheet_open]
    ].filter(function (m) { return m[1]; });
    var moreTable = $('more');
    rows(moreTable, more, function (m) { return m[0]; }, function (m) { return m[1] + ' kişi'; });
    var errTr = el('tr');
    if (d.errors.length) {
      var total = d.errors.reduce(function (a, r) { return a + r.n; }, 0);
      errTr.append(el('td', null, 'sayfa hatası: ' + d.errors[0].label), el('td', null, total));
    } else {
      errTr.append(el('td', null, 'sayfa hatası'), el('td', { class: 'muted' }, 'yok'));
    }
    if (!more.length) moreTable.replaceChildren();
    moreTable.append(errTr);
  }

  function post(path, body) {
    body.init = init;
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (res) {
        if (res.status === 403) throw new Error('forbidden');
        if (!res.ok) throw new Error('failed');
        return res.json();
      });
  }

  function renderNotes() {
    var d = state.data;
    var list = $('notes');
    list.replaceChildren();
    var open = d.notes.filter(function (n) { return !n.done_at; }).length;
    $('note-count').textContent = open ? '(' + open + ')' : '';
    var shown = d.notes.filter(function (n) {
      if (state.filter === 'all') return true;
      if (state.filter === 'done') return !!n.done_at;
      return n.kind === state.filter;
    });
    var empty = $('notes-empty');
    empty.hidden = shown.length > 0;
    empty.textContent = state.filter === 'idea'
      ? 'Henüz fikir yok. Bota yazdığın her mesaj buraya düşer.'
      : 'Burada henüz mesaj yok.';

    shown.forEach(function (n) {
      var li = el('li', { class: 'note' + (n.done_at ? ' done' : '') });
      var head = el('div', { class: 'note-head' });
      var meta = KINDS[n.kind] || n.kind;
      if (n.kind !== 'idea') {
        var where = [DEVICES[n.device], n.country ? country(n.country) : null].filter(Boolean).join(', ');
        if (where) meta += ' · ' + where;
      }
      head.append(el('span', { class: 'note-kind' + (n.kind === 'idea' ? ' mine' : '') }, meta), el('time', null, when(n.ts, d.now)));
      // Long ideas (moved over from GitHub) show their title; the rest opens under "devamı".
      var split = n.text.indexOf('\n\n');
      var title = split > 0 ? n.text.slice(0, split) : n.text;
      var rest = split > 0 ? n.text.slice(split + 2) : '';
      li.append(head, el('p', { class: 'note-text' }, title));
      var moreText = null;
      if (rest) {
        moreText = el('div', { class: 'note-more', id: 'more-' + n.id }, rest);
        moreText.hidden = true;
        li.append(moreText);
      }
      if (n.contact) li.append(el('p', { class: 'note-contact' }, 'iletişim: ' + n.contact));

      var foot = el('div', { class: 'note-foot' });
      var mark = el('button', { class: 'mark', type: 'button' }, n.done_at ? 'yapıldı ✓' : 'yapıldı');
      mark.addEventListener('click', function () {
        var wasDone = !!n.done_at;
        n.done_at = wasDone ? null : Date.now();
        renderNotes();
        post('/api/panel/note', { id: n.id, action: wasDone ? 'undone' : 'done' }).catch(function () {
          n.done_at = wasDone ? Date.now() : null;
          renderNotes();
          flash('Kaydedilemedi, yeniden dene.');
        });
      });
      var hide = el('button', { type: 'button' }, 'sil');
      hide.addEventListener('click', function () {
        var idx = d.notes.indexOf(n);
        d.notes.splice(idx, 1);
        renderNotes();
        post('/api/panel/note', { id: n.id, action: 'hide' }).then(function () {
          flash('Silindi.', 'geri al', function () {
            d.notes.splice(Math.min(idx, d.notes.length), 0, n);
            renderNotes();
            post('/api/panel/note', { id: n.id, action: 'unhide' }).catch(function () { flash('Geri alınamadı, yeniden dene.'); });
          });
        }).catch(function () {
          d.notes.splice(idx, 0, n);
          renderNotes();
          flash('Silinemedi, yeniden dene.');
        });
      });
      if (moreText) {
        var more = el('button', { class: 'more', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'more-' + n.id }, 'devamı');
        more.addEventListener('click', function () {
          moreText.hidden = !moreText.hidden;
          more.setAttribute('aria-expanded', String(!moreText.hidden));
          more.textContent = moreText.hidden ? 'devamı' : 'kapat';
        });
        foot.append(more);
      }
      foot.append(mark, hide);
      li.append(foot);
      list.append(li);
    });
  }

  var flashTimer = 0;
  function flash(text, actionText, action) {
    var bar = $('flash');
    if (!bar) { bar = el('div', { id: 'flash', class: 'flash', role: 'status' }); document.body.append(bar); }
    bar.replaceChildren(el('span', null, text));
    if (actionText) {
      var b = el('button', { type: 'button' }, actionText);
      b.addEventListener('click', function () { bar.classList.remove('on'); action(); });
      bar.append(b);
    }
    bar.classList.add('on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { bar.classList.remove('on'); }, 6000);
  }

  function load() {
    statusEl.hidden = false;
    statusEl.textContent = 'defter açılıyor…';
    return post('/api/panel/data', { range: state.range }).then(function (d) {
      state.data = d;
      statusEl.hidden = true;
      if ($('p-stats').hidden && $('p-notes').hidden) $('p-stats').hidden = false;
      renderStats(d);
      renderNotes();
    }).catch(function (err) {
      statusEl.textContent = err.message === 'forbidden'
        ? "Bu defteri yalnız sahibi, Telegram'daki irticalen botundan açabilir."
        : 'Defter yüklenemedi. Bağlantını kontrol edip sayfayı yenile.';
    });
  }

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      if (!state.data) return;
      document.querySelectorAll('.tab').forEach(function (o) {
        var on = o === t;
        o.setAttribute('aria-selected', String(on));
        $(o.getAttribute('aria-controls')).hidden = !on;
      });
    });
  });
  $('range').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.dataset.range === state.range) return;
    state.range = b.dataset.range;
    this.querySelectorAll('button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    post('/api/panel/data', { range: state.range }).then(function (d) {
      state.data = d;
      renderStats(d);
      renderNotes();
    }).catch(function () { flash('Yüklenemedi, yeniden dene.'); });
  });
  $('filters').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    state.filter = b.dataset.filter;
    this.querySelectorAll('button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    renderNotes();
  });

  if (!init) statusEl.textContent = "Bu defter yalnız Telegram'daki irticalen botundan açılır.";
  else load();
})();
</script>
</body>
</html>
`;
