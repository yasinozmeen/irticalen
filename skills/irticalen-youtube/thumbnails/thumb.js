// Shared by every thumbnail template. Reads the query string, fills the page, then grows the topic
// as large as its box allows — words are never split (only whole words wrap to the next line).
//
//   ?topic=pareto ilkesi   the topic (required)
//   &caption=10 dk araştırma · 1 dk konuşma
//   &lang=tr               tr | en (lowercasing rules + the small labels)
//   &frame=frame.jpg       a still from the video (only the "kare" template uses it)
//   &focus=70              where the face is, 0–100 from the left of the still (default 50)
(function () {
  var params = new URLSearchParams(location.search);
  var lang = params.get('lang') === 'en' ? 'en' : 'tr';
  var topic = (params.get('topic') || 'pareto ilkesi').toLocaleLowerCase(lang);
  var caption = params.get('caption') || '';
  var frame = params.get('frame');
  var focus = Math.min(100, Math.max(0, Number(params.get('focus') || 50)));

  var LABELS = {
    tr: { yourTopic: 'konun', arc: ['nedir?', 'bir örnek', 'ne düşünüyorum?'] },
    en: { yourTopic: 'your topic', arc: ['what is it?', 'an example', 'what do I think?'] },
  };
  document.documentElement.lang = lang;

  var set = function (selector, text) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = text;
    });
  };
  set('[data-caption]', caption);
  set('[data-your-topic]', LABELS[lang].yourTopic);
  document.querySelectorAll('[data-arc]').forEach(function (el) {
    el.textContent = LABELS[lang].arc[Number(el.getAttribute('data-arc'))];
  });
  document.querySelectorAll('[data-frame]').forEach(function (el) {
    if (frame) {
      el.style.backgroundImage = 'url("' + frame.replace(/"/g, '%22') + '")';
      el.style.backgroundPosition = focus + '% center';
    }
    else {
      el.classList.add('is-empty');
      el.setAttribute('data-empty', lang === 'en' ? 'a still from the video' : 'videodan bir kare');
    }
  });

  // Topic text + the red full stop glued to the last word (a non-breaking join, so the dot never
  // lands alone on a new line).
  document.querySelectorAll('[data-topic]').forEach(function (el) {
    el.textContent = '';
    el.appendChild(document.createTextNode(topic));
    var dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = '.';
    el.appendChild(dot);
  });

  function fit(el) {
    var max = Number(el.getAttribute('data-max') || 220);
    var min = Number(el.getAttribute('data-min') || 48);
    var box = el.parentElement;
    for (var size = max; size >= min; size -= 2) {
      el.style.fontSize = size + 'px';
      var fitsWidth = el.scrollWidth <= el.clientWidth + 1;
      var fitsHeight = el.offsetHeight <= box.clientHeight;
      var lines = Math.round(el.offsetHeight / (size * 1.02));
      if (fitsWidth && fitsHeight && lines <= 3) return;
    }
  }

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    document.querySelectorAll('[data-topic]').forEach(fit);
    document.body.setAttribute('data-ready', '1');
  });
})();
