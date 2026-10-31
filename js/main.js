// Set the hero name as a poster: each line scaled to span the full content
// width, then shrunk as a stack if it would push the hero past the first screen.
// Landscape screens get two lines, portrait screens one word per line.
(function () {
  var hero = document.querySelector('.hero');
  var name = hero.querySelector('.hero__name');
  var parts = name.getAttribute('aria-label').split(' ');
  var layout = '';

  function build() {
    var wide = window.innerWidth / window.innerHeight > 1.3;
    var next = wide ? 'wide' : 'tall';
    if (next === layout) return false;
    layout = next;

    var lines = wide ? [parts.slice(0, -1).join(' '), parts[parts.length - 1]] : parts;
    name.innerHTML = '';
    lines.forEach(function (text) {
      var line = document.createElement('span');
      line.className = 'fit';
      line.setAttribute('aria-hidden', 'true');
      line.textContent = text;
      name.appendChild(line);
    });
    return true;
  }

  function fit() {
    var words = name.querySelectorAll('.fit');
    var width = name.clientWidth;
    var sizes = [];
    words.forEach(function (word) {
      word.style.fontSize = '100px';
      sizes.push(100 * width / word.scrollWidth);
    });

    var nameStyle = getComputedStyle(name);
    var lineHeight = parseFloat(nameStyle.lineHeight) / parseFloat(nameStyle.fontSize);
    var chrome = hero.querySelector('.nav').offsetHeight +
      hero.querySelector('.hero__foot').offsetHeight +
      parseFloat(nameStyle.marginTop) + parseFloat(nameStyle.marginBottom) +
      parseFloat(getComputedStyle(hero).paddingBottom);
    var available = window.innerHeight - chrome;
    var stack = sizes.reduce(function (a, b) { return a + b; }, 0) * lineHeight;
    var scale = Math.min(1, available / stack);

    words.forEach(function (word, i) {
      word.style.fontSize = (sizes[i] * scale) + 'px';
    });
  }

  function start() {
    build();
    fit();
    name.classList.add('is-in');
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    window.addEventListener('load', start);
  }

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      build();
      fit();
    }, 100);
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();

// Copy the email address and confirm in the status line.
(function () {
  var button = document.querySelector('[data-copy]');
  var status = document.querySelector('.contact__status');
  if (!button || !navigator.clipboard) return;

  var timer;
  button.addEventListener('click', function () {
    navigator.clipboard.writeText(button.dataset.copy).then(function () {
      button.textContent = 'Copied';
      status.textContent = 'Email copied to your clipboard.';
    }, function () {
      status.textContent = 'Couldn’t copy. Select the address above instead.';
    });
    clearTimeout(timer);
    timer = setTimeout(function () {
      button.textContent = 'Copy email';
      status.textContent = '';
    }, 2400);
  });
})();
