// g31 — THE MEGA-RUN's structural pins, gate by gate (A0 first).
// Gate A0: the Lantern is ONE module. script.js used to carry a duplicated
// twin of lantern.js that had already drifted (its mute list lacked
// request_done) — the twin is dead; index rides lantern.js through hooks.
const { test, expect } = require('@playwright/test');

test('gA0: script.js carries NO lantern twin — lantern.js is the single source', async ({ page }) => {
  const sjs = await (await page.request.get('/script.js')).text();
  // the twin's load-bearing structures may never come back
  expect(sjs).not.toContain('NOTIF_TYPE_META');
  expect(sjs).not.toContain('function subscribeNotifications');
  expect(sjs).not.toContain('function renderLanternCenter');
  // the ONE module rides in versioned (cache-bust discipline)
  expect(sjs).toMatch(/from '\.\/lantern\.js\?v=[\d.]+'/);
});

test('gA0: the index page hooks ride into the ONE Lantern (router, chip, scroll-lock)', async ({ page }) => {
  const sjs = await (await page.request.get('/script.js')).text();
  expect(sjs).toContain('openTarget: openNotifTarget');       // in-page deep-link router
  expect(sjs).toContain('onRowNavigate: showLanternBackChip'); // the back chip
  expect(sjs).toContain('onOpen: hideLanternBackChip');
  expect(sjs).toContain('keepScrollLock');                     // modal-under-lantern guard
});

test('gA0: the drift is dead — lantern.js mute strip carries request_done + the exports exist', async ({ page }) => {
  const ljs = await (await page.request.get('/lantern.js')).text();
  // the mute chip list (the exact drift the twin had)
  const mutes = ljs.slice(ljs.indexOf('renderLanternMutes'), ljs.indexOf('renderLanternMutes') + 600);
  expect(mutes).toContain("'request_done'");
  // the shared surface index depends on
  expect(ljs).toContain('export function initLantern');
  expect(ljs).toContain('export function openLanternCenter');
  expect(ljs).toContain('export async function markAllNotifsRead');
});

// ── gate A2 — THE LETTER ROOM ────────────────────────────────────────────────
test('gA2: decline is SILENT — the sender-side pins (pending == declined, generic block copy)', async ({ page }) => {
  const js = await (await page.request.get('/account.js')).text();
  // the sender's row treats 'request' and 'declined' identically — the two
  // states must be indistinguishable on their side (anti-harassment)
  expect(js).toMatch(/c\.state === 'request' \|\| c\.state === 'declined'/);
  // a rules-denied first letter renders GENERIC copy (a blocked member must
  // never learn they're blocked)
  expect(js).toContain("can't receive your letter");
  // the inbox never alert()s — the friendly status line owns failures
  const inboxBlock = js.slice(js.indexOf('function initInbox('));
  expect(inboxBlock).not.toContain('alert(');
});

test('gA2: every profile sheet carries the letter door (✉ Message → the Letter Room)', async ({ page }) => {
  const sjs = await (await page.request.get('/script.js')).text();
  expect(sjs).toContain('profile-message');
  expect(sjs).toContain("'account.html#inbox/new/'");
  const js = await (await page.request.get('/account.js')).text();
  expect(js).toMatch(/#inbox\\\/new\\\//);            // the route regex exists
  expect(js).toContain('openComposeNew');
});

test('gA2: request-first wiring pins — the strip, the flip, the block, the conv-mute', async ({ page }) => {
  const js = await (await page.request.get('/account.js')).text();
  expect(js).toContain('isIncomingRequest');
  expect(js).toMatch(/updateDoc\(doc\(db, 'conversations', openConvId\), \{ state: nextState \}\)/);
  expect(js).toMatch(/doc\(db, 'blocks', user\.uid, 'list'/);   // block writes to MY list
  expect(js).toContain("'conv:' + openConvId");                 // per-conversation mute key
  expect(js).toMatch(/kind: 'peer', state: 'request', creatorUid: user\.uid/); // the knock-first create
});

// ── gate A3 — GROUPS ─────────────────────────────────────────────────────────
test('gA3: groups wiring pins — solo birth, append-only add, self-leave, creator-remove', async ({ page }) => {
  const js = await (await page.request.get('/account.js')).text();
  expect(js).toMatch(/participants: \[user\.uid\], kind: 'group', state: 'open', name/); // solo birth
  expect(js).toContain('participants: [...(c.participants || []), addBtn.dataset.add]'); // append-LAST (the rules pin)
  expect(js).toContain(".filter((u) => u !== user.uid)");                                // self-leave
  const html = await (await page.request.get('/account.html')).text();
  expect(html).toContain('id="inbox-new-group"');
  expect(html).toContain('id="inbox-members"');
  expect(html).toMatch(/inbox-group-name" maxlength="60"/);                              // the rules cap, mirrored
});

// ── gate A4 — IMAGES IN LETTERS (the legal spine, client half) ──────────────
test('gA4: sealed-until-accept — a request-state image NEVER fetches its URL (source pins)', async ({ page }) => {
  const js = await (await page.request.get('/account.js')).text();
  // the sealed branch renders the chip; only the ELSE branch mints an imgbox
  // (the hydrate pass resolves URLs from imgboxes alone — no box, no fetch)
  expect(js).toMatch(/sealed\s*\?\s*'<span class="inbox-img-chip">🖼 Image — accept to view<\/span>'/);
  expect(js).toContain("cc.kind === 'peer' && cc.state === 'request'");
  // report-and-preserve: the image evidence rides the report doc
  expect(js).toMatch(/if \(reportFor\.imgRef\) rep\.imagePath = reportFor\.imgRef/);
  // the kill-switch + verified-email gates speak BEFORE the pick
  expect(js).toContain('uploadsAllowed');
  expect(js).toContain('user.emailVerified');
  // the upload path pins the conversation (the rules re-check it)
  expect(js).toContain("'uploads/' + user.uid + '/dm-' + convId + '/'");
});

// ── gate A5 — the adversarial-panel fixes (client half) ──────────────────────
test('gA5: blocking severs the peer thread + hides blocked group letters (source pins)', async ({ page }) => {
  const js = await (await page.request.get('/account.js')).text();
  // my live block list drives the filters
  expect(js).toMatch(/onSnapshot\(collection\(db, 'blocks', user\.uid, 'list'\)/);
  // a blocked peer conversation vanishes from my list
  expect(js).toMatch(/c\.kind === 'peer' && iBlocked\(otherUid\(c\)\)/);
  // a blocked member's group letters don't render
  expect(js).toContain('if (isGroup && !mine && iBlocked(m.senderUid)) return;');
  // ANY permission-denied send stays generic (a blocked member can't confirm it)
  expect(js).toContain("can't receive your letter");
  expect(js).toContain("permission-denied");
});

// ── MILESTONE B — curator tools ──────────────────────────────────────────────
test('gB: card-status labels are Blake-gold, painted post-paint from animeStatus', async ({ page }) => {
  const js = await (await page.request.get('/script.js')).text();
  expect(js).toContain('function applyCuratorStatusToCard');
  expect(js).toContain('CURATOR_STATUS_LABEL');
  expect(js).toContain("loadCuratorStatus");
  // set via textContent (no XSS) + injected off the save-state hook
  expect(js).toContain('txt.textContent = CURATOR_STATUS_LABEL[status].label');
  expect(js).toContain('applyCuratorStatusToCard(card, animeId)');
  const css = await (await page.request.get('/style.css')).text();
  const block = css.slice(css.indexOf('.card-status-label {'), css.indexOf('.card-status-label {') + 400);
  expect(block).toContain('255, 213, 74');   // gold — Blake's mark
});

test('gB (visual): the status label resists the .card .info span cascade — COMPUTED pixels', async ({ page }) => {
  // the adversarial panel caught the label's <span> children inheriting
  // `.card .info span` (gold/1rem/bold) + the Top-10 `.spotlight-stack .card
  // .info span` gold-gradient PILL. The fix uses <div>+<i>; pin the RESULT.
  await page.goto('/index.html');
  const m = await page.evaluate(() => {
    const mk = () => window.renderAnimeCardMarkup({ Title: 'Test', Genre: 'X', Rating: '9', image: 'x.png' }, { animeId: 'test' });
    const buildLabel = () => {
      const label = document.createElement('div'); label.className = 'card-status-label';
      const g = document.createElement('i'); g.className = 'csl-glyph'; g.textContent = '🏮';
      const t = document.createElement('i'); t.className = 'csl-text'; t.textContent = 'Watching now';
      label.append(g, t); return label;
    };
    const card = mk(); document.body.appendChild(card);
    const label = buildLabel(); card.querySelector('.info').appendChild(label);
    const cs = getComputedStyle(label.querySelector('.csl-text'));
    const spot = document.createElement('div'); spot.className = 'spotlight-stack'; document.body.appendChild(spot);
    const card2 = mk(); spot.appendChild(card2);
    const label2 = buildLabel(); card2.querySelector('.info').appendChild(label2);
    const cs2 = getComputedStyle(label2.querySelector('.csl-text'));
    return { color: cs.color, fontSize: parseFloat(cs.fontSize), spotColor: cs2.color, spotBg: cs2.backgroundImage };
  });
  expect(m.color).toBe('rgb(255, 224, 130)');   // amber #ffe082, NOT the `gold` keyword rgb(255,215,0)
  expect(m.fontSize).toBeLessThan(14);           // ~0.66rem, not the inherited 1rem
  expect(m.spotColor).toBe('rgb(255, 224, 130)'); // Top-10: still amber, not gold-pill
  expect(m.spotBg).toBe('none');                  // and NOT the gold gradient pill
});

test('gB: the info-request writes suggestions kind:info (not the review-demand rollup)', async ({ page }) => {
  const js = await (await page.request.get('/script.js')).text();
  expect(js).toContain('data-inforeq');
  expect(js).toContain("kind: 'info'");
  expect(js).toMatch(/addDoc\(collection\(db, 'suggestions'\), docData\)/);
  // the admin queue distinguishes info rows
  const sug = await (await page.request.get('/admin/suggestions.js')).text();
  expect(sug).toContain("data.kind === 'info'");
});

test('gB: the curator admin page exists on the scaffold (admin-gated, no Mode-1 dep)', async ({ page }) => {
  const html = await (await page.request.get('/admin/curation.html')).text();
  expect(html).toContain('id="admin-gate"');
  expect(html).toContain('id="admin-main"');
  expect(html).toContain('curation.js');
  expect(html).not.toContain('npm run mode1');       // pure Firestore — works on the deployed site
  const fab = await (await page.request.get('/admin-fab.js')).text();
  expect(fab).toContain('/admin/curation.html');     // reachable from the FAB
});

// ── MILESTONE C — discovery + community ──────────────────────────────────────
test('gC1: the review machinery keys on reviewKey — the 44 catalog rooms never move (source pins)', async ({ page }) => {
  const js = await (await page.request.get('/script.js')).text();
  expect(js).toContain('function reviewKey(anime)');
  // reviewKey === communityKey for every pre-C case (catalog slug / al: secondary)
  expect(js).toMatch(/return \(anime && anime\.__communityKey\) \? anime\.__communityKey : communityKey\(anime\)/);
  // the three review functions + comments now key through reviewKey
  const commIdx = js.indexOf('function communityMarkup(anime)');
  expect(js.slice(commIdx, commIdx + 120)).toContain('reviewKey(anime)');
  expect(js).toContain('__unreviewed');
  expect(js).toContain('unreviewed-tape');
  expect(js).toContain('data-commreview');
});

test('gC1 (behavior): the unreviewed primary modal is yellow-tape + gold-free + al:-keyed', async ({ page }) => {
  await page.goto('/index.html');
  const m = await page.evaluate(async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-commreview', '');
    // C-panel: hostile AniList strings ride the dataset transport RAW —
    // the sinks must escape (the XSS the panel caught, never again).
    Object.assign(btn.dataset, {
      anilistId: '99777', title: 'Pin Test Show',
      romaji: '<img src=x onerror=window.__rarPwned=1>',
      genre: 'Action<svg onload=window.__rarPwned=2>', desc: 'A synopsis.'
    });
    document.body.appendChild(btn); btn.click();
    await new Promise((r) => setTimeout(r, 800));
    const left = document.querySelector('.sheet--left');
    const kicker = document.querySelector('.unreviewed-tape .ut-kicker');
    return {
      tape: !!document.querySelector('.unreviewed-tape'),
      noRating: !(left && left.querySelector('.rating-badge')),
      noReview: !(left && left.querySelector('.modal-review')),
      goldFree: !/ffd54a|is-creator/i.test(left ? left.innerHTML : 'x'),
      reviewForm: !!document.getElementById('rev-form-al:99777'),
      commList: !!document.getElementById('comm-list-al:99777'),
      // C-panel HIGHs, pinned:
      pwned: window.__rarPwned || 0,                                   // the payloads must be inert
      romajiInjected: !!(left && left.querySelector('.modal-romaji img')),
      genreInjected: !!(left && left.querySelector('.genre-chip svg')),
      kickerColor: kicker ? getComputedStyle(kicker).color : '',       // hazard yellow-green, never Blake-gold
      composerWired: !!document.getElementById(`composer-post-al:99777`),
    };
  });
  expect(m.tape).toBe(true);
  expect(m.noRating).toBe(true);        // Blake's rating never fabricated
  expect(m.noReview).toBe(true);
  expect(m.goldFree).toBe(true);        // gold appears NOWHERE (his voice is absent here)
  expect(m.reviewForm).toBe(true);      // community reviews fully alive, keyed al:<id>
  expect(m.commList).toBe(true);
  expect(m.pwned).toBe(0);              // AniList-sourced romaji/genre execute NOTHING
  expect(m.romajiInjected).toBe(false);
  expect(m.genreInjected).toBe(false);
  expect(m.kickerColor).toBe('rgb(227, 224, 78)');   // #e3e04e — the caution hue, not #ffd54a's
  expect(m.composerWired).toBe(true);
});

test('gC-panel: the comments wiring keys on reviewKey — the tape column can never go dead again', async ({ page }) => {
  const sjs = await (await page.request.get('/script.js')).text();
  // the exact defect: subscribeComments/wireComments keyed communityKey while
  // commentsMarkup keyed reviewKey — ids never matched for the synthetic.
  expect(sjs).not.toMatch(/const s = communityKey\(anime\)/);
  // the whole room family keys on reviewKey now: commentsMarkup,
  // subscribeComments, wireComments, communityMarkup, subscribeReviews,
  // wireCommunity — dropping ANY retrofit re-splits the synthetic's rooms.
  expect((sjs.match(/const s = reviewKey\(anime\)/g) || []).length).toBeGreaterThanOrEqual(6);
});

test('gC-panel→F: Hidden Gems is reachable at the BOTTOM of Discover (the Milestone-F move)', async ({ page }) => {
  const sjs = await (await page.request.get('/script.js')).text();
  // the bridge must carry the fetcher the Discover fill calls
  expect(sjs).toMatch(/window\.rarDiscovery = \{[\s\S]{0,600}?fetchHiddenGemsCached/);
  // Milestone F (Blake B3): gems fill from buildDiscoverSections — the home
  // strip and its IO wiring are GONE (never a hidden-block IO deadlock again)
  expect(sjs).toMatch(/fillDiscoverGems\(\)/);
  expect(sjs).not.toMatch(/lazyFillOnView\([^)]*[gG]ems/);
  expect(sjs).not.toMatch(/function fillHomeGems/);
  const html = await (await page.request.get('/index.html')).text();
  expect(html).toContain('id="discover-gems-block"');
  expect(html).not.toContain('id="home-gems-block"');
  // and the live bridge really exposes the fetcher
  await page.goto('/index.html');
  await page.waitForFunction(() => !!(window.rarDiscovery && window.rarDiscovery.fetchHiddenGemsCached), null, { timeout: 15000 });
});

test('gA0: the live lantern still exposes the pure model on index (behavior anchor)', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.lanternModel === 'function', null, { timeout: 15000 });
  const m = await page.evaluate(() => {
    const now = Date.now();
    const r = window.lanternModel([
      { type: 'reply', fromUid: 'x', createdAtMillis: now },
      { type: 'blake_message', fromUid: 'G2jGRa14u8bzGAmeBTkvXy8PKmr1', createdAtMillis: now - 1000 },
      { type: 'comment_vote', fromUid: 'y', createdAtMillis: now },
    ], 0);
    return { unread: r.unreadCount, blake: r.unreadBlake, first: r.sorted[0].type, rollup: r.rollup.count };
  });
  expect(m.unread).toBe(3);
  expect(m.blake).toBe(1);
  expect(m.first).toBe('blake_message');   // Blake sorts first — gold discipline
  expect(m.rollup).toBe(1);                // votes collapse
});

// ── gate C3 — CONSTELLATION WRAPPED ─────────────────────────────────────────
// The member's year as a purple star map. THE HEART PIN: exactly ONE gold
// element may ever appear on this member surface — the join-day star.

test('gC3: the account page carries the Constellation tab, panel, and versioned wiring', async ({ page }) => {
  const html = await (await page.request.get('/account.html')).text();
  expect(html).toContain('data-tab="wrapped"');
  expect(html).toMatch(/id="tab-wrapped"[^>]*hidden/);
  expect(html).toMatch(/href="wrapped\.css\?v=[\d.]+"/);
  const ajs = await (await page.request.get('/account.js')).text();
  expect(ajs).toMatch(/from '\.\/wrapped\.js\?v=[\d.]+'/);   // cache-bust from birth
  // C-panel (LOW, fixed): pin the tabs ARRAY LITERAL itself — a bare
  // toContain("'wrapped'") survived deleting the array entry (the click
  // handler + deep-link still matched).
  expect(ajs).toMatch(/const tabs = \[[^\]]*'wrapped'[^\]]*\]/);
  expect(ajs).toContain('ensureWrapped');                    // lazy like activity
  // C-panel (MED, fixed): the ONLY gold on this member surface is the join
  // star, painted from wrapped.js — the stylesheet may carry NO gold INK
  // (hex pins only: the word "gold" legitimately lives in comments/selectors).
  const css = await (await page.request.get('/wrapped.css')).text();
  expect(css).not.toMatch(/ffd54a|ffe082|ffd700|f0d34a|rgba?\(255, ?21[0-9]/i);
});

test('gC3: the pure model is TRUTHFUL — stats keys, the gold singleton, the honest year fence', async ({ page }) => {
  // account.html redirects signed-out visitors before the poll can settle —
  // the model is page-agnostic, so import the module directly (unversioned:
  // specs must not carry ?v= literals the bump script would strand).
  await page.goto('/index.html');
  await page.evaluate(async () => { await import('/wrapped.js'); });
  await page.waitForFunction(() => !!window.wrappedModel, null, { timeout: 15000 });
  const m = await page.evaluate(() => {
    const W = window.wrappedModel;
    const y = 2026;
    const feb = Date.UTC(y, 1, 14), may = Date.UTC(y, 4, 2);
    const raw = {
      items: [
        { path: 'reviews/one-punch-man/items/u1', createdAtMs: feb, rating: 9 },
        { path: 'comments/one-punch-man/items/c1', createdAtMs: may },
        { path: 'reviews/old/items/u1', createdAtMs: Date.UTC(y - 1, 3, 1), rating: 2 },  // last year: fenced out
      ],
      replies: [], discussions: [], threads: [{ path: 'forum/t1', createdAtMs: may }], posts: [],
      saves: [{ animeId: 'one-punch-man', ms: feb, title: 'One Punch Man' }],
      caps: {}
    };
    const joined = W.computeWrapped(raw, y, Date.UTC(y, 6, 2), new Map([['one-punch-man', 'Shonen/Action']]), 'u1');
    const veteran = W.computeWrapped(raw, y, Date.UTC(y - 2, 6, 2), new Map(), 'u1');
    const layout = W.layoutStars(joined);
    const layout2 = W.layoutStars(joined);
    return {
      statKeys: Object.keys(joined.stats).sort().join(','),
      reviews: joined.stats.reviews, avg: joined.stats.avgRating,
      goldCount: layout.placed.filter((s) => s.kind === 'gold-join').length,
      vetGold: veteran.gold, vetBegan: typeof veteran.skyBegan === 'number',
      deterministic: JSON.stringify(layout) === JSON.stringify(layout2),
      genres: joined.stats.topGenres.join(','),
    };
  });
  // the truthful set — NO watch-time, NO votes, NO first-saved, ever
  expect(m.statKeys).toBe('avgRating,comments,discussions,joinMs,posts,replies,reviews,saves,threads,topGenres');
  expect(m.reviews).toBe(1);            // last year's review is fenced out
  expect(m.avg).toBe(9);
  expect(m.goldCount).toBe(1);          // the singleton
  expect(m.vetGold).toBeNull();         // an earlier join is NEVER plotted into this year
  expect(m.vetBegan).toBe(true);        // …it becomes the gold caption instead
  expect(m.deterministic).toBe(true);   // hash layout, no Math.random
  expect(m.genres).toBe('Shonen,Action');
});

test('gC3: the render vocabulary — ONE gold star, purple data stars, dust below the data floor', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(async () => { await import('/wrapped.js'); });
  await page.waitForFunction(() => !!window.wrappedModel, null, { timeout: 15000 });
  const m = await page.evaluate(() => {
    const W = window.wrappedModel;
    const y = 2026;
    const raw = {
      items: [{ path: 'reviews/one-punch-man/items/u1', createdAtMs: Date.UTC(y, 1, 14), rating: 9 }],
      replies: [], discussions: [], threads: [], posts: [],
      saves: [{ animeId: 'one-punch-man', ms: Date.UTC(y, 0, 5), title: 'One Punch Man' }], caps: {}
    };
    const model = W.computeWrapped(raw, y, Date.UTC(y, 6, 2), new Map(), 'u1');
    const svg = W.skySvg(model);
    const dust = Array.from(svg.matchAll(/class="wr-dust"[^/]*r="([\d.]+)" [^/]*opacity="([\d.]+)"/g));
    const emptyModel = W.computeWrapped({ items: [], replies: [], discussions: [], threads: [], posts: [], saves: [], caps: {} }, y, Date.UTC(y, 6, 2), new Map(), 'u1');
    return {
      goldFills: (svg.match(/#ffe082/g) || []).length,
      goldKinds: (svg.match(/data-kind="gold-join"/g) || []).length,
      reviewPurple: svg.indexOf('#e3c9ff') !== -1,
      dustCount: dust.length,
      dustBelowFloor: dust.every((d) => parseFloat(d[1]) <= 1.0 && parseFloat(d[2]) <= 0.22),
      dustHasNoKind: !/wr-dust[^/]*data-kind/.test(svg),
      emptyIsEmpty: emptyModel.empty, emptyStillGold: !!emptyModel.gold,
      // C-panel (MED, fixed): the accessible story equals the visual story
      freshAria: W.skyAria(emptyModel),
      activeAria: W.skyAria(model),
      zeroChips: (W.statsHtml(W.computeWrapped({
        items: [{ path: 'comments/x/items/c1', createdAtMs: Date.UTC(y, 2, 3) }],
        replies: [], discussions: [], threads: [], posts: [], saves: [], caps: {}
      }, y, Date.UTC(y - 2, 0, 1), new Map(), 'u1')).match(/wr-chip-big">0</g) || []).length,
    };
  });
  expect(m.goldFills).toBe(1);          // gold paints the join star and NOTHING else
  expect(m.goldKinds).toBe(1);
  expect(m.reviewPurple).toBe(true);
  expect(m.dustCount).toBeGreaterThan(50);
  expect(m.dustBelowFloor).toBe(true);  // ambient dust never outshines a real datum
  expect(m.dustHasNoKind).toBe(true);   // star counts stay data-pure
  expect(m.emptyIsEmpty).toBe(true);    // zero-activity flags drive the no-zero-chips branch
  expect(m.emptyStillGold).toBe(true);  // …but a this-year join still lights its star
  expect(m.freshAria).not.toMatch(/\b0 /);              // no zeros-parade for screen readers
  expect(m.freshAria).toContain('day you joined');
  expect(m.activeAria).toContain('1 review');           // non-zero counts still speak
  expect(m.zeroChips).toBe(0);                          // a one-comment member sees NO zero chips
});
