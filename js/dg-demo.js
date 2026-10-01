/* Debenhams Group case study: the brand switcher demo.
   Each brand button sets data-brand on the stage, which is all it takes to
   re-theme the card and buttons (see css/dg-demo.css). The readout beside
   it is read back off the stage's own custom properties, so it always
   says what is actually on screen. The stage itself is inert; a polite
   live region tells screen reader users what changed. */
(function () {
  'use strict';

  var demo = document.querySelector('.dg-demo');
  if (!demo) return;
  var stage = demo.querySelector('.dg-stage');
  var buttons = demo.querySelectorAll('.dg-switch button');
  var live = demo.querySelector('.dg-live');
  var out = {
    font: demo.querySelector('[data-read="font"]'),
    action: demo.querySelector('[data-read="action"]'),
    corners: demo.querySelector('[data-read="corners"]'),
    caseBtn: demo.querySelector('[data-read="case"]')
  };

  function read(name) {
    return getComputedStyle(stage).getPropertyValue(name).trim();
  }

  /* tokens write some colours short (#000); show every one in full */
  function hex(v) {
    v = v.toUpperCase();
    return /^#[0-9A-F]{3}$/.test(v) ? '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v;
  }

  function render(label) {
    var font = read('--font-family-base').split(',')[0].replace(/['"]/g, '');
    var action = hex(read('--surface-action'));
    var radius = read('--radius-default');
    var corners = radius === '0px' ? 'Square' : radius + ' radius';
    var cornersSaid = radius === '0px' ? 'square corners' : radius + ' corner radius';
    var caseBtn = read('--case-btn1') === 'none' ? 'Sentence case' : 'Uppercase';

    out.font.textContent = font;
    out.action.querySelector('.v').textContent = action;
    out.action.querySelector('.sw').style.setProperty('--sw', action);
    out.corners.textContent = corners;
    out.caseBtn.textContent = caseBtn;
    if (label && live) {
      live.textContent = label + ': ' + font + ', action colour ' + action + ', ' + cornersSaid + ', ' + caseBtn.toLowerCase() + ' buttons.';
    }
  }

  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(buttons, function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      stage.setAttribute('data-brand', btn.getAttribute('data-brand'));
      render(btn.textContent.trim());
    });
  });

  render();
})();
