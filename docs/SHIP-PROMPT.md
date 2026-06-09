<!-- author: Cowork | date: 2026-06-09 -->
# v1.10.0 — BATCH: checkpoint commit (11-14) → the IMAGE EXPERIENCE overhaul. APPLY all, NO deploy. ONE smoke at the end.

> The image tier shipped + passed smoke (image renders, upload works). Blake now wants images to become a full **experience** — inline placement, thumbnails, a lightbox, images in reviews, dedupe — across the whole community. **Mode ULTRAMAX, go wide. Blake: "let code go nuts and think of all possibilities especially user ability."** Still image-security-sensitive → the gate-12/13/14 protections (locked storage, magic-byte, EXIF, caps, email-verify, kill-switch, report, atomic-remove, cascade) REMAIN INVIOLATE and extend to every new surface. Full adversarial review mandatory. STAGED — no deploy.

## ⭐ STANDING DIRECTIVE
Every interactive element at full brand parity by default. No native/unstyled control reaches smoke. Cohesion across surfaces is a requirement this batch (Blake item 9).

## STEP 0 — checkpoint commit gates 11-14
Commit the current working tree (gates 11-14, the image tier) as a Blake-authored, zero-trailer, excludes-held-out save-point BEFORE remodeling the image code. STAGED — NO deploy. (Protects the work before the overhaul.)

## THE OVERHAUL — Blake's items (his words = spec) + full latitude
1. ✅ image renders on the OPM thread (no change).
2. **Lightbox / full-view.** *"once you click in the image is cut off. Maybe it goes to the side of the modal for full view? Or for tall images make it smaller."* → clicking any image opens a **branded lightbox** (full-view overlay, tall images scaled to fit the viewport, never cut off; Esc/click-out closes; reduced-motion safe). Applies to every image surface.
3. **Admin control UI.** *"as admin UI for picking/pinning/locking needs to be updated."* → the in-thread admin controls (📌 Pin to Rising / Lock / Remove) get a proper branded treatment (they read unfinished now).
4. ✅ upload looks fine (no change).
5. **Inline image PLACEMENT in threads + dedupe.** *"I want users to have the ability to choose where their image goes in their thread. Because power scalers love to showcase where exactly in the manga their argument exists. code can propose and implement. No 2 same images can be uploaded to prevent spam but unique ones can."*
   - The thread body becomes a **mixed text+image composition** — the user inserts images at chosen positions in their description (propose the mechanism: an "insert image here" in the RarComposer that drops an image token into the body, rendered inline via `markdown.js` resolving to a scheme-gated `getDownloadURL`; the imageRefs still pin to the caller's `uploads/{uid}/` prefix). Order preserved.
   - **Dedupe:** no two **identical** images (content-hash in the `onObjectFinalized` CF — reject/dedupe a duplicate upload; unique images fine). Propose the scope (per-user / per-thread / global) and the user-facing message.
6. **Images in community reviews.** *"Images should also be able to exist in community reviews. As part of a title or in the review itself."* → extend the upload + inline-placement to the **community review composer** (the review body can carry inline images). Same storage rules/pipeline/report/remove (reviews are a public surface like posts — the "posts-only, no DMs" rule becomes "public surfaces: posts + reviews, no DMs"). Update storage/firestore rules to cover review-attached images.
7. **Kill-switch UI.** *"Kill switch needs clean UI."* → the `admin/reports.html` 🖼 Image uploads toggle gets a clean branded design (it's a raw-ish control now).
8. **Thread thumbnail + inline images everywhere.** *"When I started a thread I couldn't choose a thumbnail to go with it. So on the tavern page it just looks like text. it should get the same treatment as the OPM thumbnail."*
   - **Thread thumbnail:** starting a thread lets the user **choose a thumbnail** (distinct from the attached-anime cover) that shows on the **tavern list card** — so a text thread can have a picture like the OPM cover thread does.
   - **Inline images in comments/replies too:** *"Comments should also be able to put images in their response, not just attach or both."* → the comment/reply composers get the same inline-image insertion (not just an attachment).
   - To be crystal clear (Blake's own summary): **uploading a thread = choose a thumbnail + place images in the description in any order; comments can place images inline in their response.**
9. **Cohesion + intuitiveness.** *"Code needs to make sure it all fits, makes sense, has intuitive AI, and fits the theme."* → one consistent image vocabulary across threads / replies / comments / reviews (same insert affordance, same lightbox, same report, same brand). It should feel like ONE designed system, not bolted-on per surface.

## Go-all-out mandate (Blake: "let code go nuts, especially user ability")
Beyond the list: think about what users want to DO with images in an anime community (panel-by-panel power-scaling arguments, side-by-side comparisons, reaction images, spoiler-blurred images via the gate-11 `||spoiler||` hook, alt-text for a11y, etc.). Propose + build the tasteful set; mark anything big as PITCH. Protect-the-heart holds throughout (images are purple surfaces, count-free, no gold).

## Verify
ALL tracks green + new specs (lightbox, inline-image render/order, thumbnail, review images, dedupe-hash, the extended storage/firestore rules). **5-agent adversarial review** — focus the security lenses on: the inline-image token (can it inject? can it reference someone else's upload? is the src always SDK-derived?), the dedupe hash (no bypass / no DoS), review-image rules parity with posts, the lightbox (no SSRF/scheme escape), and the heart. Walk every surface yourself with the Storage emulator. Then Blake's ONE numbered smoke.

## Report (lean): the checkpoint hash · per-item · the inline-image mechanism + dedupe scope you chose · the go-all-out additions · adversarial findings+fixes · test counts · Blake's numbered smoke (uploads need the Storage emulator). NO deploy.
