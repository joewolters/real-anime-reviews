// admin/brand-select.js — the branded SELECT for admin pages (classic script → window.RarBrandSelect).
// <!-- author: Code | date: 2026-07-03 -->
// This is account.js's proven brandSelect (round 4, Blake recurring #2) ported
// verbatim for the admin pages' classic-script consumers — account.js is an ES
// module, so the editors can't import it directly; unification back into one
// shared file is banked post-cutover (don't let the copies drift on purpose).
// Native <select> popups can't be themed (the OS white outline Blake kept
// reporting), so this is a button + role=listbox wearing the site's purple.
// Fully keyboard-driven: Enter/Space/ArrowDown opens, arrows rove, Home/End
// jump, Esc closes back to the button.
// Styles ride ../style.css (every admin page loads it) — the .acct-dd-* rules
// INCLUDING the .acct-dd-menu[hidden]{display:none} twin (~style.css:10466,
// the [hidden] symmetry rule). No CSS is duplicated here.
// API: window.RarBrandSelect({ host, label, options: [{value,label}], value, onChange })
//   → { get value, set value } — the same contract account.js's brandSelect returns.
(function () {
  'use strict';

  function brandSelect({ host, label, options, value, onChange }) {
    if (!host) return null;
    let cur = value || '';
    host.innerHTML = '';
    host.classList.add('acct-dd-wrap');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'acct-dd-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (label) btn.setAttribute('aria-label', label);
    const txt = document.createElement('span'); txt.className = 'acct-dd-text';
    const chev = document.createElement('span'); chev.className = 'acct-dd-chev'; chev.setAttribute('aria-hidden', 'true'); chev.textContent = '▾';
    btn.appendChild(txt); btn.appendChild(chev);
    const menu = document.createElement('div');
    menu.className = 'acct-dd-menu'; menu.setAttribute('role', 'listbox');
    if (label) menu.setAttribute('aria-label', label);
    menu.hidden = true;
    host.appendChild(btn); host.appendChild(menu);

    const labelFor = (v) => { const o = options.find((x) => x.value === v); return o ? o.label : (options[0] ? options[0].label : ''); };
    const paint = () => {
      txt.textContent = labelFor(cur);
      menu.querySelectorAll('.acct-dd-opt').forEach((b) => {
        const on = b.getAttribute('data-value') === cur;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
      });
    };
    options.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'acct-dd-opt';
      b.setAttribute('role', 'option'); b.setAttribute('data-value', o.value);
      b.textContent = o.label;
      b.addEventListener('click', () => { cur = o.value; paint(); setOpen(false); btn.focus(); if (onChange) onChange(cur); });
      menu.appendChild(b);
    });
    const setOpen = (open) => {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.classList.toggle('is-open', open);
      if (open) (menu.querySelector('.acct-dd-opt.is-on') || menu.querySelector('.acct-dd-opt'))?.focus();
    };
    btn.addEventListener('click', () => setOpen(menu.hidden));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); }
    });
    menu.addEventListener('keydown', (e) => {
      const opts = Array.from(menu.querySelectorAll('.acct-dd-opt'));
      const i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || opts[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (opts[i - 1] || opts[opts.length - 1]).focus(); }
      else if (e.key === 'Home') { e.preventDefault(); opts[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); opts[opts.length - 1]?.focus(); }
      else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.focus(); }
    });
    host.addEventListener('focusout', (e) => {
      if (!menu.hidden && !host.contains(e.relatedTarget)) setOpen(false);
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !host.contains(e.target)) setOpen(false);
    });
    paint();
    return {
      get value() { return cur; },
      set value(v) { cur = v || ''; paint(); },
    };
  }

  window.RarBrandSelect = brandSelect;
})();
