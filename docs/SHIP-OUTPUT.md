<!-- author: Code | date: 2026-06-09 -->
# v1.10.0 — MEGA-BATCH: image/UX fixes + live-in-box composer + Profiles (15-16) + Account/DM (17-18). DONE · STAGED · NO deploy

Mode **ULTRAMAX**. The UX mandate ("stop looking like social-media-in-training — clean, essentials, intentional") drove every surface. Four checkpoint commits, all Blake-authored / trailer-clean / pushed. A **5-agent adversarial review** (the contenteditable composer was the headline XSS lens) came back **XSS CLEAN · DM admin-floor HOLDS · Heart PASS**, and caught **1 HIGH + 3 MED** — all fixed and re-verified. **All tracks green. Production untouched. Nothing deploys.**

## Checkpoint hashes (all pushed to the public repo, per your call)
- **`912b48b`** — mega-batch 1/3: Part A image/UX fixes + Part B live-in-box composer
- **`c368982`** — mega-batch 2/3: public profiles (gates 15-16)
- **`3587d10`** — mega-batch 3/3: account redo + the Message-Blake inbox (gates 17-18)
- **`31c50c7`** — the adversarial-review fixes (the HIGH + 2 MED + DM-rules hygiene below), all tracks re-proven green after.

## PART A — image/UX fixes
1. **The "looks like a period" inline image — ROOT CAUSE found:** the seed was a literal **1×1-pixel** PNG. The resolver was always correct (proved with a real-pixel e2e: it decodes + renders inline). Fixed the seed to real **480×270** images **and** added a display floor (`min 96×64`) so no tiny upload can ever vanish into punctuation again.
2. **Thumbnail now shows in the thread VIEW**, not just the card — card↔thread image presentation is consistent.
3. **Topic pill sits in one place on every card** — overlaid on the artwork when a thumbnail exists, in the head row when not — so thumbed and text threads read uniformly.
4. **Reviews get a dedicated Cover slot** — the picker's "🖼 Add a cover" (distinct from inline body images); it leads the collapsed review row. Own-prefix-pinned in the rules.

## PART B — the live-in-box composer (the headline)
Every **user** composer (comment · comment-reply · Tavern thread · Tavern reply · community review · review-discussion) is now a **true rich editor**: **bold/italic/links/spoiler-pills/[img:N] chips render live as you type, in the input** — the separate preview panel is **gone for users**. Admin/anime composers are untouched.
- **Approach:** a `contenteditable` VIEW over the original textarea, which stays in the DOM as the hidden **markdown MODEL + submit source**. Every change serializes back to the textarea and fires its `input` event — so every existing counter, cap, lock state, and post handler works **with zero changes**.
- **Paste is sanitized by construction:** the handler reads **`text/plain` only** (HTML clipboards are flattened — there is no `getData('text/html')` anywhere), and every node is built via `createElement`/`textContent`/`setAttribute` (the only two `innerHTML`s are static). Storage is the serialized markdown from a **whitelist DOM walk** (unknown elements emit text only; `<a href>` re-validated to `https?://`), and every downstream render is `markdown.js` (escape-first). The reviewer ran script tags, `img onerror`, `javascript:`/`data:` links, and attribute-breakouts through all three layers — **all inert.**
- Block mode (thread/review) styles `##` sections + lists live; Ctrl/⌘+B/I + Ctrl/⌘+Enter kept; image paste/drag-drop kept.

## PART C — gates 15-16: full public profiles
- **Dual-write + safe reads (15):** the account page writes `profiles/{uid}` (name, photo, member-since); author identity reads across the whole site go **profiles-first with a `users` fallback** — legacy accounts never break mid-migration.
- **Full routed profile page (16):** every author name (comments, replies, review rows, posts, cards, by-lines) routes to **`#profile=<uid>`** — a premium branded sheet: avatar, name, member-since, bio (escape-first), and their public threads + reviews. Deep-linkable.
- **Privacy/heart:** count-free (no karma/post-count anywhere), zero gold on any community profile, **Blake's name → his Den** (his identity is the site), **banned → suspended tombstone** (via the new public `profiles.isBanned` CF mirror), **gone → graceful former member** (no dead clicks). Private saves stay private. The `items` collection-group went public-list (the docs were already individually public; only the cross-anime query is newly legal — `threads`/`replies` CGs stay owner-only).

## PART D — gates 17-18: account redo + the Message-Blake DM
- **Cover-art ROOT CAUSE (17):** legacy `al:<id>` saves missing the `type`/`aniListId` *fields* fell into the art-less branch and never qualified for the cover backfill — both values were always in the doc id. One normalizer heals every legacy row.
- **The Inbox (18, admin-floor; peer DMs stay BANKED):** a 5th **Inbox** tab — a member opens one letter-style conversation with Blake ("this goes straight to me"); Blake replies from a new **admin Inbox page** (live list, unread dots, a Lock/Unlock toggle); the suggestion queue's new **Reply** button opens/creates that member's conversation (the suggestion-reply channel). The `onDmMessageCreate` CF notifies the other party (server-sourced identity, honors `dm` mutes, CF-owned unread mirror). The dm Lantern ping routes to the Inbox; the locked **People** folder promises peer DMs after the safety net.

## Adversarial review (5 agents) — findings → fixes
- **CLEAN verdicts:** **contenteditable/paste XSS** (3 independent layers, all verified — could not break it) · **DM admin-floor invariant HOLDS** (no path to a stranger-to-stranger surface; create enforces kind=='admin' + Blake-is-a-party + creator-is-a-party + size==2; messages senderUid-pinned, state-gated, ≤2000) · **Heart PASS** (purple + count-free everywhere; gold only on Blake's surfaces; the `items` CG widening leaks nothing new).
- **FIXED — HIGH:** public-profile "Their reviews" rows were **silent dead clicks** (`openNotifTarget` was handed the parsed object instead of the string path → threw-and-swallowed) — the exact thing the tombstone code exists to prevent. Now passes the raw path; re-verified.
- **FIXED — MED (privacy/SSRF):** author avatar `photoURL` from the `users/` fallback was only entity-escaped, not **origin-gated** — an author could point their avatar at a tracking beacon and IP-leak every viewer. Added a firebasestorage/googleusercontent allowlist at all four render sites.
- **FIXED — MED:** the Inbox could flag **your own sent message as unread to you** (no self-sender guard + client-clock vs server-time). Added a CF-written `lastSenderUid` + a server-time clamp; fixed on both the member and admin inboxes.
- **FIXED — DM rules hygiene (LOW×3 in one stroke):** the participant-writable conversation **summary branch** let a member forge `lastMessageAt` (sort/unread spoof) and write an unbounded `lastMessageText` (against the no-preview design), and carried a dead `unread` key. No client ever wrote it — so the whole summary is now **CF-owned**; the only client update is the admin Lock toggle.
- **FIXED — LOW:** a dangling card thumbnail could leave the topic chip floating over an empty wrap → the chip now lives in the head and the overlay hides it only while the thumb is loaded (failure restores the head chip).

## Tests — ALL GREEN
`npm test` **150** · `test:rules` **107** · `test:functions` **41** · `test:cf` **47** · e2e **5** (real-pixel: inline image decodes, lightbox, card thumbnail). New specs: the live-composer round-trip + paste-flatten + hostile-model XSS (g17), profile heart invariants + name-fallback + decision matrix (g18), review-cover + items-CG-public + avatar rules, the DM admin-floor + mute + isBanned-mirror CF tests.
**Ops:** practice now launches DETACHED (own window) — never inside a session task (the harness reaps it at the task timeout; that was the "random death"). `npm test` and practice both bind 8765 — never together.

## YOUR SECTIONED SMOKE (practice is up + seeded: http://127.0.0.1:8765/?emu=1)
**Sign-ins:** the seeded users are `prac-mika`…`prac-sora` (pw `practice123`); admin is `blake@practice.test` / `practice123`.

**A — images (signed in as anyone):** Open the **Tavern → One Punch Man thread**: Mika's reply shows the image **inline mid-sentence** (a real 480×270 now, not a dot) → click it for the **lightbox**. In the **list**, the "seasonal binge" thread has a **card thumbnail with the topic pill on the art**. Start a **review** on an anime → the composer has **🖼 Add a cover** (distinct from 📷 inline).

**B — the live composer (signed in):** In ANY composer (comment, a Tavern reply, a review), type `**bold**`, `||spoiler||`, a link — they **render live in the box, no preview panel**. Hit 📷 → the image drops in as a chip right where your cursor is. Paste a screenshot straight in.

**C — profiles (signed in):** Click **any author's name** anywhere → their **profile page** (avatar, member-since, their threads + reviews — click a review, it opens). Click **Blake's** name → it takes you **home to the Den**. (Admin: ban a seeded user from the reports queue, then click their name → **suspended tombstone**.)

**D — the inbox:** **Account → Inbox tab → Message Blake** → send a line. Then sign in as **admin**, open **admin/inbox.html** → your message is there with an unread dot → **reply** → back as the member, the reply lands (and pings the Lantern). Try the admin **Lock** toggle. In **admin/suggestions.html**, a suggestion with a submitter has a **Reply** button that opens their thread.

## One-liner reply
The whole mega-batch shipped across four pushed checkpoints — **Part A** fixed the "image looks like a period" (the seed was a literal 1×1 pixel; real images + a size floor now, proven in real pixels), the thread-view thumbnail, the uniform tag-on-art, and a dedicated review cover slot; **Part B** rebuilt all five user composers as a **true live-in-box rich editor** (formatting renders as you type, the preview panel is gone for users) over a hidden-textarea model so the post path is untouched and paste is text-plain-only; **Part C** delivered full **public profile pages** (avatar/bio/member-since + their threads & reviews, count-free, gold-free, Blake's name → his Den, banned → suspended); **Part D** redid the account page (cover-art root-caused), added the **Inbox tab + the Message-Blake DM** (admin-floor only, peer banked) with Blake's admin inbox + suggestion-reply — a **5-agent adversarial review came back XSS-clean on the contenteditable, the DM admin-floor invariant holds, and the heart is intact**, and I fixed the 1 HIGH (profile review dead-clicks) + 3 MED (avatar IP-beacon, inbox self-unread, the forgeable DM summary now CF-owned) it caught, with `npm test` **150** · `test:rules` **107** · `test:functions` **41** · `test:cf` **47** · e2e **5** all green; **practice is up + seeded, nothing is committed past the three checkpoints, and nothing deploys.**
