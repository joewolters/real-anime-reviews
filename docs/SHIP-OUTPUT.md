<!-- author: Code | date: 2026-06-09 -->
# v1.10.0 — THE DREAM PROFILE/ACCOUNT PLATFORM (+ 2 small fixes). DONE · STAGED · NO deploy

Mode **ULTRAMAX**. One pushed checkpoint. A **5-lens adversarial review** caught **1 HIGH + 5 MED + 4 LOW** — all fixed and re-verified. **All tracks green. Production untouched. Nothing deploys.**

## Design vision (1 para)
The profile becomes a **constellation a member arranges** — bio, self-tags, a curated (gold-free) accent, a status line, a pinned review, an image/GIF sky behind it — and `account.html` is the **studio** where they arrange it, wearing its OWN personal night: the new neon-sakura street (Blake's asset, rotated correct) under the same constellation veil, so it feels theirs without leaving the site's vocabulary. The community gains exactly ONE new currency — **Appreciate**, a purple profile-like count, the sanctioned heart carve-out — and nothing else: no post counts, no karma, no leaderboard. Gold is still only Blake's.

## The 2 small fixes
1. **Review-cover redesign:** the 48×34 inline thumb → a full-width **banner** above a stacked headline (cover-less rows untouched; dangling cover drops the banner cleanly).
2. **Pfp OR name → profile:** the author avatar opens the profile everywhere the name does (3 sites + keyboard) — and its initial paint joined the avatar origin-gate (a ripple catch).

## The dream-profile features (all built; none PITCHed)
- **Customization:** bio · status · up-to-6 self-tags · a 6-color accent (no gold by construction) · profile background (image/GIF) · a 📌 featured review.
- **Profile background** rides the existing image pipeline (magic-byte + EXIF + caps, no SVG), is reportable + admin-removable + **edit-strip-swept** (`onProfileWritten` — closes the orphan-object gap NEXT.md flagged), and is perf-safe (reduced-motion GIF freeze, own compositor layer).
- **Profile likes (the carve-out):** CF-owned count, deterministic one-ping-per-liker, no self-like, **no liking Blake**, purple-only.
- **Activity by type:** Threads / Reviews / Comments / Replies (sheet chips + account filter), via the now-public threads/replies/posts collection-groups.
- **Watchlist/favorites:** filter · sort · type controls over the live snapshot (routing intact).
- **Account studio + own night** (`data-surface="account"`, veil 0.62 — never the Den's 0.80), live preview, the rotated 2400×1200 backdrop (+ webp).

## The heart carve-out — how it stays safe
Likes are the ONE community count and they are **purple, only on the profile, never sorted/ranked**. Gold stays Blake-only (the accent palette holds no gold; a like FROM Blake renders gold by the dm precedent — provenance, not the count). Blake's own profile **cannot** be liked (rules + CF). Den stays the darkest surface.

## bg/GIF moderation + perf approach
Lock (existing storage.rules `uploads/` match) → validate/EXIF/cap (`processUploadedImage`) → report (⚑ `profile`) + atomic admin-remove → **edit-strip sweep** on change. Perf: GIF frozen to a display-scale canvas under reduced-motion; bg layers isolated to their own compositor layer; account panels are static high-alpha (no live blur over the veil pulse).

## Adversarial findings → fixes
- **HIGH:** the LIVE script.js lantern avatar bypassed the origin allowlist (index loads script.js, not lantern.js) → `profile_like` ping could IP-beacon recipients. Gated; also added the missing profile_like glyph + mute.
- **MED (heart):** rules let members like Blake's profile → `uid != ADMIN_UID` in rule + CF.
- **MED (spam):** unlike/re-like relit the bell → `.create()` (one ping per liker).
- **MED×3 (perf):** live-blur panels → static; GIF compositor isolation; freeze-canvas cap; preview no longer restarts the GIF per keystroke.
- **LOW×4:** count undercount on profile-less target (set-merge); forged-report preview bound to target prefix; chip query memoize; lazy account-activity init.

## Tests — ALL GREEN
`npm test` **158** · `test:rules` **126** · `test:functions` **56** · `test:cf` **57** · e2e **9**. New static specs `tests/g19-dream-profile.spec.js` + real-pixel `tests-e2e/dream-profile-emu.spec.js`. Live like as Ren moved Mika's CF-owned count **2→3** (fresh read confirmed).

## Checkpoint / deploy
One pushed checkpoint. APP_VERSION stays **1.9.1** (staged). Production untouched. **NO deploy** — the cutover (gate 21, on Blake's "ship it") runs indexes → hosting → firestore → storage → functions.

## YOUR NUMBERED SMOKE (practice is up + seeded: http://127.0.0.1:8765/?emu=1)
**Sign-ins:** seeded members `prac-mika`…`prac-sora` (pw `practice123`); admin `blake@practice.test` / `practice123`. Mika now wears the full kit; Sora is bare (the empty-state invite).

1. **The review banner (fix 1):** open **One Punch Man → community reviews**. Mika's review row now leads with a **big cover banner**, not a tiny thumb. Other rows stay compact.
2. **Pfp opens the profile (fix 2):** in any comment/review, click the **avatar** (not just the name) → the profile sheet opens.
3. **The dream profile:** click **Mika's** name/avatar → her sheet wears a **background**, an accent, **tags**, a status line, a 📌 **pinned review**, and an **Appreciate** count. Click the activity chips (**Threads / Reviews / Comments / Replies**).
4. **Appreciate (the carve-out):** signed in as anyone-but-Mika, hit **Appreciate** on her profile → the count moves, you get a purple state. Sign in as **Mika** → her bell has an **"X liked your profile"** ping. (Try clicking **Blake's** name → it goes **home to the Den**; there's no like button on him, by design.)
5. **The studio (Account → Profile):** the account page wears its **own neon night**. Edit your **bio / status / tags / accent**, pick a **background image or GIF**, choose a **pinned review** → **Save** → reopen your public profile (the "View your public profile" link) and see it.
6. **Activity by type (Account → My Activity):** the **All / Comments / Replies / Threads / Reviews** chips filter your own history.
7. **Watchlist controls (Account → Watchlist):** **filter by title**, **sort**, and the **All / Blake's 44 / Beyond** type chips.
8. **Moderation (admin):** in **admin/reports.html**, a reported **profile** row gets a **View** (opens the live sheet) + a background preview; **Remove** pulls a reported background atomically.

## One-liner reply
The dream profile/account platform shipped in one staged checkpoint — the two fixes (review-cover **banner** redesign + **avatar-opens-profile**) plus the full set: bio/status/**tags**/curated-gold-free-**accent**/image-or-GIF **background**/📌-**featured-review** customization, **activity separated by type**, **watchlist filter-sort-type** controls, and the account page wearing its **own neon-sakura night** under the veil; the community's one new currency is **Appreciate** — a purple, CF-owned, never-gold, never-on-Blake profile-like count (the heart carve-out) — and a **5-lens adversarial review** caught a real **HIGH** (the live lantern avatar could IP-beacon recipients) + 5 MED + 4 LOW, all fixed and re-proven with `npm test` **158** · rules **126** · functions **56** · cf **57** · e2e **9** green and a live like round-trip moving the CF-owned count 2→3; **practice is up + seeded, one checkpoint is pushed, APP_VERSION stays 1.9.1, and nothing deploys.**
