// frames.js — v1.10.0 gate 20.5 FRAME-THEMES (classic script, no modules).
// The 13 profile-frame themes. KEYS ARE LOCKED in lock-step with the rules
// lane + the picker — never rename a key without changing all three together.
// Labels are visitor-facing (evocative names carrying the anime reference);
// jp follows the site's jp-mini vocabulary (short glosses, like 隠れ家 / 旅人).
// The visuals live in frames.css under [data-frame="<key>"].
// blakeOnly: the rules enforce that ONLY Blake's account can write 'blake' —
// this list just tells the picker to present it as his.
(function () {
  'use strict';

  var FRAMES = [
    { key: 'vines',   label: 'Rainforest Vines',  jp: '蔦' },
    { key: 'stone',   label: 'Mountain Stone',    jp: '岩' },
    { key: 'cosmos',  label: 'Cosmic Sky',        jp: '星空' },
    { key: 'witch',   label: "Witch's Pact",      jp: '魔女' },
    { key: 'clover',  label: 'Five-Leaf Grimoire', jp: '五つ葉' },
    { key: 'journey', label: 'Long Journey',      jp: '旅路' },
    { key: 'shadow',  label: 'Shadow Garden',     jp: '陰' },
    { key: 'sakura',  label: 'Sakura Drift',      jp: '桜' },
    { key: 'ember',   label: 'Ember Breath',      jp: '炎' },
    { key: 'tide',    label: 'Deep Tide',         jp: '潮' },
    { key: 'storm',   label: 'Stormcall',         jp: '雷' },
    { key: 'moonlit', label: 'Moonlit Veil',      jp: '月夜' },
    { key: 'blake',   label: 'The Den Keeper',    jp: '隠れ家の主', blakeOnly: true }
  ];

  // freeze: the key list is a 3-way contract (rules + picker + CSS) — nothing
  // at runtime may mutate it.
  for (var i = 0; i < FRAMES.length; i++) Object.freeze(FRAMES[i]);
  window.RAR_FRAMES = Object.freeze(FRAMES);
})();
