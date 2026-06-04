<!-- author: Code | date: 2026-06-04 -->
# v1.8.0 — Gate 1b (Option C snapshot blur + G2 hover finding + console triage — APPLY ✓)

> Escalated to **Option C**: removed the **live full-viewport `backdrop-filter`** from `.secondary-backdrop` + `.tertiary-backdrop` (the per-repaint re-resolve tax = Blake's Firefox Paint 41%/98%-Graphics) and replaced it with a **premium static dim** — so **no engine pays a blur re-resolution on hover/scroll**. ⚠️ **Key honest finding on G2:** the secondary modal's hovers **already composite** (transform/box-shadow/border — I verified there is **no `filter` hover anywhere in the modal**), so the modal-hover lag was **100% the backdrop-filter amplification** (each hover repaint re-resolved the viewport blur), which Option C removes — there was no filter-hover surgery to do in the modal, and `.card` already uses the locked `::after` opacity-veil. Per the gate's own "don't stack speculative fixes," I did **not** invent hover changes for no measured gain. Console addendum triaged (one trivial fix, rest confirmed not-ours). `npm test` 8 passed, CSS 1008/1008. **Blake's profiler is the arbiter** — re-smoke steps below.

---

## 1. Option C — snapshot blur (the universal fix)
- **`.secondary-backdrop` + `.tertiary-backdrop`:** dropped `backdrop-filter: blur()` entirely; replaced with a **static layered dim** (`radial-gradient` depth + `linear-gradient` dim, no filter). Removed the gate-1 Firefox-only `@supports` layer-promote block (moot — there's no live blur left to promote). **Δ** `style.css` ~−16 (net; 2 rules simplified + the `@supports` block deleted).
- **Why this is the right call (mechanism, since headless can't measure — see §3):** a **live `backdrop-filter` re-resolves the blur on every composite/repaint**; that's structurally why G1's layer-promote only nudged 49%→41% (you can't cache a filter that re-samples the live backdrop). The only way to stop the per-repaint tax on **every** engine is to not run a live backdrop-filter during the interactive phase. A static dim has **zero** filter cost.
- **⚠️ Visual delta (honest):** the frost is gone — the backdrop is now a clean dark gradient dim instead of a frosted blur. **In practice this is subtle:** the drawer covers ~94vw, so the frost only ever showed in a narrow, already-dimmed left sliver. The richer radial+linear dim keeps the "gone deeper" depth. **If you miss the frost,** I can restore it cheaply by blurring the *static* content behind it once with a cached `filter:blur()` (no live backdrop-filter) — but that's added complexity for a sliver, so I went with the guaranteed-universal dim first. Your eyes decide.

## 2. G2 hover pass — measured finding (no speculative surgery)
Checked every hover in the secondary-modal flow:
- **Secondary pills / cards / rows** (`.secondary-save/-request/-platform/-ep-link:hover`, `.secondary-char/-rec`, `.more-info-entry`) — they hover with **`transform` + `box-shadow` + `border-color` + `background`. None use `filter`.** So the gate's premise ("every `filter`-transition hover forces repaints of the blurred region") had **no `filter` target in the modal** — the lag was purely the **backdrop-filter amplification**: each hover/scroll repaint re-resolved the full-viewport blur. **Option C removes the amplifier**, so those hovers are now cheap on every engine.
- **`.card` (homepage + modal cards)** — already uses the **locked treatment**: a `::after` brightness veil faded via `opacity` (`.card:hover::after{opacity:1}`) + a composited `transform: scale()`. Nothing to change.
- **The only real `filter:brightness` hovers** are 3 buttons (`.genre-shuffle-btn`, `#top10-prev/next`, `.inline-header-btn`) — homepage/header (the already-smooth page), tiny bounded elements, now trivially cheap post-Option-C. Removing their brightness would degrade the look for **zero** measured gain.
- **Decision:** no speculative hover surgery (the gate explicitly says "don't keep stacking speculative fixes"). If Blake's profiler shows residual hover cost (e.g. animated `box-shadow` repaints), the pre-painted-shadow-via-opacity conversion is the next lever — held pending real data. **Δ** 0 (correctly).

## 3. Measurement honesty (why the profiler is the arbiter)
Ran a decisive cross-engine bench: **dim-only vs live backdrop-filter vs filter-on-static-content**, with a drawer repainting each frame. Result — **all three were identical on every engine** (Gecko ~145fps, WebKit ~40fps/~75%, Blink ~60fps). That proves the **blur is NOT isolable in the headless harness** (the drawer's own repaint dominates; the GPU-compositor backdrop cost that Blake's headed Firefox profiler clearly shows is not reproduced headlessly). So I am **not** reporting headless before/after FPS for this gate — they'd be meaningless. The trustworthy inputs are **(a) the mechanism** (live backdrop-filter re-resolves per repaint; a static dim can't) and **(b) Blake's real Firefox Profiler** (the gate's success bar).

## 4. Console addendum — triaged
| # | Message | Verdict | Action |
|---|---|---|---|
| 1 | Feature-Policy "skipping unsupported feature accelerometer/clipboard-write/gyroscope…" | **Ours** — the trailer iframe `allow` listed tokens Firefox ignores | **Fixed:** trimmed `allow` to `autoplay; encrypted-media; picture-in-picture` at both call sites (`script.js:4285`, `:5163`). Benign, now silent. |
| 2 | `Cookie "__Secure-YEC" rejected` + CSP for `youtube.com/embed` | **Not ours** — YouTube embed third-party | none (the iframe is our only YT touchpoint; nothing in our code triggers it) |
| 3 | `Cross-Origin Request Blocked: data:text/plain;base64,Cg==` | **Not ours** — grep confirms **zero `data:`/`base64` fetches in our JS**; `Cg==` = base64 `"\n"`, classic extension injection | none |
| 4 | `unreachable code after return` in `15_S4Ql8…js:2724` | **Not ours** — hashed bundle name; our files are unhashed (`script.js` etc.). Extension/YT player | none |
| 5 | Fingerprinting-protection notice | **Firefox privacy feature** — expected | **Note for Blake:** this can skew profiler/screen metrics, so profiler numbers have some noise floor |
- **None relate to the perf problem** (that's Paint/backdrop-filter — profiler-confirmed). Items 3 & 4 are almost certainly a browser extension; worth Blake trying a private window (no extensions) for the cleanest profiler trace.

## Verification
| Check | Result |
|---|---|
| `node --check script.js` | **OK** (iframe `allow` trim) |
| CSS brace balance | **1008 / 1008 BALANCED** |
| `backdrop-filter` on the modal backdrops | **0** (static dims now; grep hits were comment text) |
| `prefers-reduced-motion` paths | **intact** (the `.secondary-backdrop, .secondary-modal { transition:none }` block untouched) |
| `[hidden]` symmetry | intact |
| G1 branded scrollbars | **kept** |
| `npm test` (Playwright) | **8 passed (14.9s)** |

## Bench direction (all 3 engines)
Decisive run: dim-only ≈ live-backdrop-filter ≈ filter-on-static — **identical per engine** → the harness cannot isolate the backdrop-filter cost (drawer repaint dominates). So no headless FPS claims; **mechanism + Blake's profiler** govern. Mechanism guarantees Option C removes the live backdrop-filter Paint cost on every engine.

## For Blake's re-smoke (the real arbiter)
In **Firefox**, on the same secondary-modal hover/scroll flow:
1. **Re-run the Firefox Profiler** (same 15-20s). **Success = Paint collapses to a small fraction** (was 41%). Mechanically it should — there's no live `backdrop-filter` left to re-resolve. (Tip: try a **private window / no extensions** for the cleanest trace — items 3/4 above are extension noise.)
2. **Hands:** does the pop-out now feel **noticeably smoother** during hover + scroll?
3. **Visual:** the pop-out backdrop is now a **dark gradient dim** instead of frosted blur — tell me if you miss the frost (I can restore it via cached static-blur if so).
4. **Scrollbars** are brand-purple (from G1); **Chrome** still buttery (no regression — the dim is cheaper than the blur everywhere).
- **If Paint still doesn't collapse:** per the gate I STOP and we read what the profiler says is left (likely the drawer's own content paint / box-shadows) rather than stack more speculative fixes.

## Phantom-drift audit
Verified, not assumed: confirmed the secondary modal has **no `filter` hovers** (grepped the actual `:hover` rules — the lag was the backdrop amplifier, not filter hovers, so G2's modal surgery would've been a no-op); proved headless can't isolate the blur (dim==backdrop==filter-static); the `data:` URI is **not ours** (grepped for `data:`/`base64`); confirmed both backdrops have no `backdrop-filter` property left (the grep counts were my own comment text); reduced-motion block intact; deleted all throwaway bench files from the deploy root.

## One-liner reply
v1.8.0 **Gate 1b (Option C snapshot blur + G2 finding + console triage) DONE — applied, not committed**: escalated to Option C by **removing the live full-viewport `backdrop-filter` from both modal backdrops** (the per-repaint re-resolve tax = your Firefox Paint 41%/98%-Graphics) and swapping in a **premium static gradient dim**, so **no engine pays a blur re-resolution on hover/scroll** — mechanism-guaranteed, since a live backdrop-filter structurally can't be cached (which is why G1's promote only nudged 49%→41%); ⚠️ honest visual delta: the frost is now a clean dark dim, but it only ever showed in a narrow dimmed sliver behind the 94vw drawer so it's subtle (and I can restore frost via cached static-blur if you miss it); **key G2 finding** — I verified the secondary modal's hovers **already composite** (transform/box-shadow/border, **no `filter` anywhere in the modal**), so the modal-hover lag was **entirely the backdrop-filter amplification** Option C just removed, and `.card` already uses the locked opacity-veil — so per the gate's own "don't stack speculative fixes" I did **no** invented hover surgery (the only real `filter:brightness` hovers are 3 buttons on the already-smooth homepage, now trivially cheap); I'm being upfront that **headless can't measure this** (a decisive bench showed dim==backdrop-filter==filter-static on every engine → the harness can't isolate the GPU backdrop cost your headed profiler clearly sees), so **your Firefox profiler re-run is the sole arbiter** (success = Paint collapses from 41% — mechanically it should, there's no live blur left); triaged your console: trimmed our trailer-iframe `allow` attr to silence the Feature-Policy warnings (#1, ours), confirmed the `data:`-URI (#3) + hashed-bundle `unreachable code` (#4) are **extension noise, not ours** (grep-verified no `data:` fetches), #2 is YouTube-embed third-party, and #5 is Firefox fingerprint-protection that can skew profiler metrics (try a private window); kept G1 scrollbars, reduced-motion intact, **`npm test` 8 passed**, CSS 1008/1008 — re-smoke the Firefox profiler and tell me if Paint collapsed + whether you miss the frost; if Paint's still high I STOP and report what's left rather than stack more.
