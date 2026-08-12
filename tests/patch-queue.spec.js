// THE PATCH QUEUE (docs/NEXT.md:161) — Blake's own ordered post-cutover wants.
// <!-- author: Code | date: 2026-08-10 -->
// One spec file for the batch; each item gets its own block as it lands.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const has = (hay, needle, why) => expect(hay.includes(needle), why || needle).toBe(true);
const lacks = (hay, needle, why) => expect(hay.includes(needle), why || needle).toBe(false);

// Admin pages send non-admins away. Neuter ONLY that line so the real page,
// real stylesheet and real modules load; everything else is untouched.
async function openAdmin(page, name) {
  await page.route('**/admin/*.js*', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).split("window.location.replace('../index.html');").join('void 0;');
    await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/javascript' } });
  });
  await page.goto(`/admin/${name}.html`);
  await page.waitForFunction(() => !!document.getElementById('confirm-modal'), null, { timeout: 20000 });
}

// ---------------------------------------------------------------------------
// ITEM 2 — unify the duplicated admin dialogs
// ---------------------------------------------------------------------------

test('item 2: there is exactly ONE confirm/notice implementation for admin', () => {
  // reports.js's copies were literally commented "parameterized clone of
  // suggestions'". Two implementations of one dialog drift apart — fix the
  // focus trap in one and the other keeps the bug.
  const shared = read('admin/admin-modals.js');
  has(shared, 'export function confirmModal');
  has(shared, 'export function noticeModal');

  for (const f of ['admin/reports.js', 'admin/suggestions.js']) {
    const src = read(f);
    lacks(src, 'function confirmModal(', `${f} must not redefine confirmModal`);
    lacks(src, 'function noticeModal(', `${f} must not redefine noticeModal`);
    has(src, "from './admin-modals.js?v=", `${f} imports the shared dialogs`);
  }
});

test('item 2: no admin page has regrown a native dialog', () => {
  for (const f of ['reports', 'suggestions', 'new-anime', 'catalog', 'curation', 'stats',
    'studio', 'quotes', 'season-reviews', 'edit']) {
    const src = read(`admin/${f}.js`);
    // strip comments first — the banners legitimately mention "the alert() replacement"
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code, `${f}.js must not call a native dialog`).not.toMatch(/(^|[^.\w])(alert|confirm|prompt)\s*\(/m);
  }
});

test('item 2: the shared bump target exists for both new import specifiers', () => {
  const bump = read('scripts/bump-version.js');
  has(bump, 'admin-modals.js?v= import (reports)');
  has(bump, 'admin-modals.js?v= import (suggestions)');
});

for (const page of ['reports', 'suggestions']) {
  test(`REAL PIXELS: the shared dialog behaves identically on ${page}`, async ({ page: pg }) => {
    // suggestions.html gives its glyph/kicker NO ids and reports.html does —
    // the shared module looks them up by class precisely so neither page needs
    // markup surgery to share a dialog. That is what this proves.
    await openAdmin(pg, page);
    const r = await pg.evaluate(async () => {
      const m = await import('/admin/admin-modals.js?v=2.1.0');
      const p = m.confirmModal({ glyph: '🔥', kicker: 'TEST', kickerJp: '試験', body: 'Body text here', okLabel: 'Go' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const ov = document.getElementById('confirm-modal');
      const out = {
        visible: !ov.hidden,
        opened: ov.querySelector('.confirm-card').classList.contains('is-open'),
        glyph: ov.querySelector('.confirm-glyph').textContent,
        kicker: ov.querySelector('.confirm-kicker').textContent.trim(),
        jpEl: !!ov.querySelector('.confirm-kicker .jp-mini'),
        body: ov.querySelector('.confirm-body').textContent,
        okLabel: ov.querySelector('[data-confirm="ok"]').textContent,
        cancelFocusedFirst: document.activeElement === ov.querySelector('[data-confirm="cancel"]'),
      };
      ov.querySelector('[data-confirm="ok"]').click();
      out.okResolves = await p;
      out.hiddenAfter = ov.hidden;
      const np = m.noticeModal({ body: 'notice' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.cancelHiddenDuringNotice = ov.querySelector('[data-confirm="cancel"]').hidden;
      ov.querySelector('[data-confirm="ok"]').click();
      await np;
      out.cancelRestored = !ov.querySelector('[data-confirm="cancel"]').hidden;
      return out;
    });
    expect(r.visible).toBe(true);
    expect(r.opened, 'the entrance transition ran').toBe(true);
    expect(r.glyph).toBe('🔥');
    expect(r.kicker).toBe('TEST 試験');
    expect(r.jpEl, 'the jp sublabel is a real element, not interpolated markup').toBe(true);
    expect(r.body).toBe('Body text here');
    expect(r.okLabel).toBe('Go');
    expect(r.cancelFocusedFirst, 'the SAFE option takes focus first').toBe(true);
    expect(r.okResolves).toBe(true);
    expect(r.hiddenAfter).toBe(true);
    expect(r.cancelHiddenDuringNotice, 'a notice has one exit').toBe(true);
    expect(r.cancelRestored, 'the overlay is handed back intact for the next confirm').toBe(true);
  });
}

// ---------------------------------------------------------------------------
// ITEM 3 — the header search's own ✕
// ---------------------------------------------------------------------------

test('item 3: the ✕ exists on BOTH headers, and the native one really is killed', () => {
  // style.css:43 kills ::-webkit-search-cancel-button site-wide — that global
  // kill is exactly why this pill had no way to clear. If it were ever removed,
  // this custom ✕ would be a duplicate, so the two facts are pinned together.
  has(read('style.css'), '::-webkit-search-cancel-button', 'the native clear is suppressed site-wide');
  for (const f of ['index.html', 'account.html']) {
    has(read(f), 'id="site-search-clear"', `${f} carries the clear button`);
    expect(read(f), `${f} ships it hidden`).toMatch(/id="site-search-clear"[^>]*hidden/);
  }
  has(read('style.css'), '.search-clear[hidden]{ display: none; }', 'the [hidden] twin — it is a flex item');
});

test('item 3: clearing re-enters through the input handler, never a second code path', () => {
  // "Clear" and "delete the last character" must land in the same place, or the
  // live filter can be reset by one and not the other.
  const src = read('script.js');
  const block = src.slice(src.indexOf('PATCH QUEUE item 3'), src.indexOf('PATCH QUEUE item 3') + 900);
  has(block, 'new Event("input"', 'the ✕ dispatches input rather than duplicating the empty branch');
  has(block, 'searchInput.focus()');
});

test('REAL PIXELS: the ✕ appears only with text, clears, and stays out of the tight band', async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (e) {} });

  // wide: the ✕ does its job
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/index.html');
  const x = page.locator('#site-search-clear');
  await expect(x, 'hidden while empty — the pill keeps its resting width').toBeHidden();
  await page.fill('#site-search', 'demon');
  await expect(x).toBeVisible();
  await x.click();
  await expect(page.locator('#site-search')).toHaveValue('');
  await expect(x).toBeHidden();
  expect(await page.evaluate(() => document.activeElement === document.getElementById('site-search')),
    'focus returns to the input').toBe(true);

  // narrow: item 4's budgeted band is untouched
  for (const w of [390, 375, 360, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/index.html');
    await page.fill('#site-search', 'demon');
    await expect(x, `the ✕ must stay out of the ${w}px band`).toBeHidden();
    const m = await page.evaluate(() => ({
      acct: Math.round(document.querySelector('#auth-open').getBoundingClientRect().right),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(m.acct, `account button reachable at ${w}px`).toBeLessThanOrEqual(w);
    expect(m.over, `no overflow at ${w}px`).toBeLessThanOrEqual(0);
  }
});

// ---------------------------------------------------------------------------
// ITEM 5 — the Curator's Desk badges
// ---------------------------------------------------------------------------

test('item 5: counts are fetched on MENU OPEN, not on every page load', () => {
  // The FAB mounts on every page of the site. Counting on load would bill three
  // query fans per navigation for a number nobody is looking at.
  const src = read('admin-fab.js');
  has(src, 'refreshBadges();', 'the open path triggers the fetch');
  expect(src, 'the fetch hangs off setOpen, not init').toMatch(/if \(open\) \{[^}]*refreshBadges\(\)/);
  lacks(src, 'init() {\n  buildFab();\n  refreshBadges');
});

test('item 5: each badge counts what its own queue shows', () => {
  const fab = read('admin-fab.js');
  // reports.js skips status === 'resolved'; suggestions.js splits on 'reviewed'.
  // The badges mirror those rules, so a third status can never make a badge
  // disagree with the page it links to.
  has(fab, "where('status', '!=', 'reviewed')");
  has(fab, "where('status', '!=', 'resolved')");
  has(read('admin/reports.js'), "d.status === 'resolved'", 'the queue rule the badge mirrors');
  has(read('admin/suggestions.js'), "status === 'reviewed'", 'the queue rule the badge mirrors');
  // unread letters reuses the Letter Room's definition rather than a second one
  has(fab, 'c.lastSenderUid === uid', 'my own send is never unread');
  has(fab, 'lastReadAt');
  has(read('account.js'), 'c.lastSenderUid !== user.uid', 'the definition being mirrored');
});

test('item 5: a failed count never paints a confident zero', () => {
  const src = read('admin-fab.js');
  has(src, 'if (sug !== null)');
  has(src, 'if (rep !== null)');
  has(src, 'if (letters !== null)');
});

test('REAL PIXELS: badges paint, hide at zero, clamp, and never wear gold', async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (e) {} });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarFabBadges, null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    const m = window.rarFabBadges;
    // the FAB is hidden for non-admins; reveal the shell so the badges paint
    document.getElementById('admin-fab-root').classList.remove('admin-fab-hidden');
    document.getElementById('admin-fab-menu').classList.remove('admin-fab-menu-hidden');
    Object.assign(m.counts, { suggestions: 3, reports: 0, letters: 128 });
    m.paint();
    const grab = (k) => {
      const el = document.querySelector(`.admin-fab-badge[data-badge="${k}"]`);
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { text: el.textContent, hidden: el.hidden, w: Math.round(r.width),
        h: Math.round(r.height), bg: cs.backgroundColor, color: cs.color };
    };
    const res = { sug: grab('suggestions'), rep: grab('reports'), let: grab('letters') };
    Object.assign(m.counts, { suggestions: 0, reports: 0, letters: 0 });
    m.paint();
    res.allZeroHidden = [...document.querySelectorAll('.admin-fab-badge')].every((e) => e.hidden);
    return res;
  });

  expect(out.sug.text).toBe('3');
  expect(out.sug.hidden).toBe(false);
  expect(out.rep.hidden, 'zero is not news — it hides').toBe(true);
  expect(out.let.text, 'clamped so a runaway number cannot widen the row').toBe('99+');
  expect(out.sug.h, 'a real, readable pill').toBeGreaterThanOrEqual(18);
  expect(out.allZeroHidden, 'every badge disappears at zero').toBe(true);

  // PROTECT THE HEART: gold is Blake's identity mark. It does not decorate a
  // to-do count, not even his own. Purple only.
  for (const b of [out.sug, out.let]) {
    const [r, g, bl] = b.bg.match(/\d+/g).map(Number);
    expect(bl, `badge background must not be gold (${b.bg})`).toBeGreaterThan(r * 0.6);
    expect(g < r || bl > g, `badge must not read gold/amber (${b.bg})`).toBe(true);
  }
});

test('item 5: the badge ships its [hidden] twin', () => {
  has(read('admin-fab.css'), '.admin-fab-badge[hidden] { display: none; }');
});

// ---------------------------------------------------------------------------
// ITEM 7 — the review-targeted deep link (ONE reachable gap closed; see below)
// ---------------------------------------------------------------------------

test('item 7: a pending deep-link overrides both review filters', () => {
  // applyReviewDeepLink() hunts its target among the RENDERED rows and returns
  // silently when there isn't one. With a ratings band set, or "My review" on,
  // the deep-linked review was filtered out before the halo could run: the
  // notification opened the right anime and then did nothing, silently.
  // v1.9.1b already established the principle for "My review" — it overrides
  // the band because you always want YOUR review. A deep link earns the same.
  const src = read('script.js');
  const at = src.indexOf('PATCH QUEUE item 7 — a pending deep-link OVERRIDES');
  expect(at, 'the override exists').toBeGreaterThan(-1);
  const block = src.slice(at, at + 1400);
  has(block, 'dl.slug === s', 'scoped to THIS anime');
  has(block, 'rows.some((r) => r.id === dl.id)', 'and only when the target is really there');
  // the override must come BEFORE the two filters, or it cannot override them
  expect(block.indexOf('deepLinkHere')).toBeLessThan(block.indexOf('showMineOnly && meUid'));
});

test('item 7: review rows carry their doc id, not just a dataset attribute', () => {
  // The override needs to reason about rows BEFORE they are in the DOM. The row
  // objects only ever had { li, createdAtMillis, score, rating, uid } — the id
  // lived solely on li.dataset.id, so an id check against the row objects would
  // have been permanently false and the whole override a no-op.
  has(read('script.js'), 'rows.push({ id: docSnap.id, li, createdAtMillis, score, rating, uid: d.uid });');
});

// ---------------------------------------------------------------------------
// ITEM 6 — comment-list DIFF rendering (the oldest banked debt)
// ---------------------------------------------------------------------------

test('item 6: the snapshot handler no longer nukes the list or the listeners', () => {
  const src = read('script.js');
  const lo = src.indexOf('PATCH QUEUE item 6 — DIFF RENDERING');
  expect(lo, 'the diff handler exists').toBeGreaterThan(-1);
  const block = src.slice(lo, src.indexOf('if (countEl) countEl.textContent', lo));

  // the three things it used to do to EVERY row on EVERY snapshot
  lacks(block, "listEl.innerHTML = ''", 'the list is never wiped');
  lacks(block, 'sweepReplies();', 'open reply panels are not swept on snapshot');
  lacks(block, 'authorUnsubs.length = 0', 'listeners are not mass-killed per snapshot');

  has(block, 'prev.sig === sig', 'unchanged rows are left alone');
  has(block, 'rows.push(prev.row)');
  has(block, 'newHost.replaceWith(oldHost)', 'an open reply panel is transplanted, not discarded');
});

test('item 6: the signature covers every field the row renders', () => {
  // If commentItemEl renders a field the signature ignores, that field silently
  // stops updating — the worst kind of bug this design can produce.
  const src = read('script.js');
  const sig = src.slice(src.indexOf('const rowSignature = (d) =>'),
    src.indexOf('const rowSignature = (d) =>') + 800);
  for (const field of ['text', 'likesCount', 'dislikesCount', 'pinned',
    'displayName', 'photoURL', 'removed', 'imageRefs', 'editedAt']) {
    has(sig, field, `signature must cover ${field}`);
  }
  has(sig, 'isAuthorGone(d)', 'and the item-7 tombstone');
});

test('REAL DOM: a half-typed reply survives the list reordering around it', async ({ page }) => {
  // THE BUG, stated as a test. Someone else posts, the list re-sorts, and the
  // reply you were halfway through writing must still be there — with the caret
  // where you left it.
  await page.addInitScript(() => { try { sessionStorage.setItem('rar:welcomed', '1'); } catch (e) {} });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.rarCommentDiff, null, { timeout: 20000 });

  const out = await page.evaluate(() => {
    const { reorderListPreservingState } = window.rarCommentDiff;
    const ul = document.createElement('ul');
    ul.id = 'diff-harness';
    document.body.appendChild(ul);

    const rows = ['a', 'b', 'c'].map((id) => {
      const li = document.createElement('li');
      li.dataset.cid = id;
      const ta = document.createElement('textarea');
      ta.className = 'draft';
      li.appendChild(ta);
      ul.appendChild(li);
      return li;
    });

    // member starts typing a reply on row "b" and leaves the caret mid-word
    const draft = rows[1].querySelector('.draft');
    draft.value = 'half a thought';
    draft.focus();
    draft.setSelectionRange(4, 4);

    // somebody else posts: a new row arrives and the order changes
    const fresh = document.createElement('li');
    fresh.dataset.cid = 'new';
    ul.appendChild(fresh);
    const moved = reorderListPreservingState(ul, [fresh, rows[2], rows[1], rows[0]]);

    const after = ul.querySelector('[data-cid="b"] .draft');
    const res = {
      moved,
      sameNode: after === draft,
      value: after.value,
      focused: document.activeElement === after,
      caret: after.selectionStart,
      order: Array.from(ul.children).map((n) => n.dataset.cid),
    };

    // and a no-op reorder must not touch the DOM at all
    res.noopReturnedFalse = reorderListPreservingState(ul, Array.from(ul.children));
    ul.remove();
    return res;
  });

  expect(out.moved, 'the reorder actually happened').toBe(true);
  expect(out.sameNode, 'the SAME element survived — not a rebuilt clone').toBe(true);
  expect(out.value, 'the half-typed reply is intact').toBe('half a thought');
  expect(out.focused, 'and the member is still typing in it').toBe(true);
  expect(out.caret, 'with the caret exactly where they left it').toBe(4);
  expect(out.order).toEqual(['new', 'c', 'b', 'a']);
  expect(out.noopReturnedFalse, 'an unchanged order touches nothing').toBe(false);
});
