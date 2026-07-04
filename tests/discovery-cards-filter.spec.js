// Returning-visitor fixture: the filter test clicks, so the welcome door must be
// dismissed (sessionStorage seed). Harmless for the evaluate-only card tests too.
const { test, expect } = require('./welcomed.js');

// v1.8.4 (gate 2) — the discovery card shell + the 3-way review-status filter.
// Outside cards aren't rendered on any surface until G3, so we exercise the
// builders directly off window.rarDiscovery (the same path G3/G4 will call) plus
// the filter segment that lives in the panel now. Offline/deterministic — the one
// click only checks the secondary shell appears (its content fetch is fire-and-
// forget and not awaited).
test.describe('v1.8.4 discovery cards + 3-way filter', () => {
  test('outside card: NOT REVIEWED sticker, community score, saves wired (al:<id>, vertical stack)', async ({ page }) => {
    await page.goto('/');
    const info = await page.evaluate(() => {
      // An id that is NOT one of Blake's 44 (huge id, safe).
      const media = {
        id: 999999001,
        title: { english: 'Some Outside Show', romaji: 'Soto', native: '外' },
        coverImage: { large: 'https://example.com/x.jpg', color: '#abc' },
        averageScore: 73, genres: ['Action', 'Comedy', 'Drama'], seasonYear: 2025,
        format: 'TV', status: 'RELEASING', episodes: 12,
      };
      const card = window.rarDiscovery.createDiscoveryCard(media);
      document.body.appendChild(card);
      return {
        cls: card.className,
        anilistId: card.dataset.anilistId,
        animeid: card.dataset.animeid,
        badge: card.querySelector('.not-reviewed-badge')?.textContent.trim() || null,
        hasPin: !!card.querySelector('.blake-pin'),
        rating: card.querySelector('.card-rating')?.textContent.trim() || null,
        iconRowDisplay: getComputedStyle(card.querySelector('.icon-row')).display,
        iconRowDir: getComputedStyle(card.querySelector('.icon-row')).flexDirection,
        hasSaveBtns: !!(card.querySelector('.fav-btn') && card.querySelector('.watch-btn')),
        title: card.querySelector('.title-text')?.textContent.trim() || null,
      };
    });
    expect(info.cls).toContain('is-not-reviewed');
    expect(info.cls).not.toContain('is-blake-pick');
    expect(info.anilistId).toBe('999999001');
    expect(info.badge).toContain('NOT REVIEWED');
    expect(info.hasPin).toBe(false);
    expect(info.rating).toBe('73%');                 // community score, not Blake's "N/10"
    // v1.8.4 gate 5 carry-over #2 — outside cards now SAVE (via al:<id>), icons stacked
    // vertically on the right (bookmark top, heart below) clear of the badge.
    expect(info.animeid).toBe('al:999999001');       // the al:<id> save doc id
    expect(info.hasSaveBtns).toBe(true);
    expect(info.iconRowDisplay).toBe('flex');        // shown now (was display:none in G2)
    expect(info.iconRowDir).toBe('column-reverse');  // bookmark top, heart below
    expect(info.title).toBe('Some Outside Show');
  });

  // Milestone F: the pin says "Reviewed" — the gold IS his mark (Blake's rename)
  test('upgrade path: a catalog id renders the reviewed card + the gold "Reviewed" pin', async ({ page }) => {
    await page.goto('/');
    const info = await page.evaluate(() => {
      // animeData is a classic-script global-lexical const (not window.animeData);
      // a classic-realm evaluate can read it directly.
      const list = (typeof animeData !== 'undefined' && Array.isArray(animeData)) ? animeData : [];
      const cat = list.find(a => a.AniListId);
      if (!cat) return { skip: true };
      // Feed the discovery builder an AniList-shaped node carrying his catalog id.
      const media = {
        id: Number(cat.AniListId),
        title: { english: cat.Title, romaji: cat.TitleRomaji || null, native: cat.TitleNative || null },
        coverImage: { large: 'https://example.com/x.jpg', color: null },
        averageScore: 80, genres: ['Action'], format: 'TV', status: 'FINISHED',
      };
      const card = window.rarDiscovery.createDiscoveryCard(media);
      return {
        skip: false,
        cls: card.className,
        hasPin: !!card.querySelector('.blake-pin'),
        pinText: card.querySelector('.blake-pin')?.textContent.trim() || null,
        notReviewed: !!card.querySelector('.not-reviewed-badge'),
        catTitle: cat.Title,
        cardTitle: card.querySelector('.title-text')?.textContent.trim() || null,
      };
    });
    expect(info.skip).toBe(false);                   // catalog must expose an AniListId
    expect(info.cls).toContain('is-reviewed');       // the REAL reviewed card
    expect(info.cls).toContain('is-blake-pick');
    expect(info.hasPin).toBe(true);
    expect(info.pinText.trim()).toMatch(/Reviewed$/);          // the renamed pin
    expect(info.pinText).not.toContain('Reviewed by Blake');   // zero stragglers (Blake's C3)
    expect(info.notReviewed).toBe(false);            // not an outside card
    expect(info.cardTitle).toBe(info.catTitle);
  });

  test('AniList titles are escaped at render (XSS discipline)', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(() => {
      const media = {
        id: 999999002,
        title: { english: '<img src=x onerror="alert(1)">', romaji: null, native: null },
        coverImage: { large: 'https://example.com/x.jpg' },
        averageScore: 50, genres: ['"><b>oops</b>'],
      };
      const card = window.rarDiscovery.createDiscoveryCard(media);
      return {
        titleHtml: card.querySelector('.title-text').innerHTML,
        // an injected handler would show up as an element with onerror=alert
        injected: !!card.querySelector('img[onerror*="alert"]'),
      };
    });
    expect(out.titleHtml).toContain('&lt;img');      // escaped, not a live tag
    expect(out.injected).toBe(false);
  });

  test('3-way filter: segment present, "Not yet" disabled on catalog, toggling works', async ({ page }) => {
    await page.goto('/');
    // Open the filter panel so its segment buttons are actionable.
    await page.locator('#filter-btn').click();
    const seg = page.locator('#filter-reviewed');
    await expect(seg).toHaveCount(1);
    await expect(seg).toBeVisible();
    const all = seg.locator('.fr-seg[data-reviewed="all"]');
    const reviewed = seg.locator('.fr-seg[data-reviewed="reviewed"]');
    const notyet = seg.locator('.fr-seg[data-reviewed="notyet"]');

    await expect(all).toHaveClass(/is-active/);
    await expect(notyet).toBeDisabled();             // catalog-only: present but honest

    // Programmatically enabling outside cards (what a Discover surface does in G3)
    // un-disables "Not yet".
    await page.evaluate(() => window.rarDiscovery.setFilterHasOutsideCards(true));
    await expect(notyet).toBeEnabled();

    // Clicking "Reviewed" moves the active segment.
    await reviewed.click();
    await expect(reviewed).toHaveClass(/is-active/);
    await expect(all).not.toHaveClass(/is-active/);
  });
});
