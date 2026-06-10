<!-- author: Cowork | date: 2026-06-09 -->
# v1.10.0 — ACCOUNT/PROFILE OVERHAUL ROUND 2: make it a REAL social platform. APPLY, practice verify, NO deploy.

> Round-1 dream-profile shipped the features but Blake's verdict: **"it just looks incomplete… doesn't look like a real social media app."** This round goes BIGGER — Discord/Reddit-grade structure, a much larger/wider editor + preview, each section its own surface, unique UI + animations, and the consent dead-end fixed. **Mode ULTRAMAX, full creative latitude — "I really want the UI to be unique, I want animations to be unique."** Build your best; clean + premium + intentional (no plain text anywhere). 5-agent adversarial review. Checkpoint-commit + push at the end. STAGED — no deploy.

## ⭐ THE BAR
Discord/Reddit-class settings UX: intuitive, sectioned, every control branded, **no plain text left alone** (Blake: *"Every text prompt should be unique, pills, some kind of glow etc. No text should be left alone"*). Unique animations (tasteful, perf-safe, reduced-motion). Protect-the-heart holds (gold = Blake only; Appreciate is the one allowed purple count).

## Blake's items (his words = spec)
1. **WIDEN + enlarge the whole thing.** *"We need to widen the Profile modal more… this preview should be much larger and wider. The entire modal. More design opportunities and a way to flesh out a person."* → the profile editor + its live preview get much bigger/wider; a richer canvas with room to actually compose an identity.
2. **A "see what viewers see" view.** *"There should be a way to see what viewers see."* → a clear toggle/button that shows the profile exactly as the public sees it (vs the edit view).
3. **Each section = its own surface with its own options.** *"Every dropdown 'Watchlist, Favorites, My activity' should be their own modals with their own options… it just looks messy and incomplete."* → Profile / Watchlist / Favorites / My Activity / Inbox each become their **own dedicated, fleshed-out surface** with section-specific controls (not cramped sections sharing one column). Discord/Reddit-style left-nav → full panel.
4. **Account settings split out.** *"Account 'password and stuff' should also be its own dropdown in the side bar… this menu should be more intuitive. Something like discord or reddit."* → email/password/account management moves OUT of the profile editor into its **own "Settings/Account" nav item**, intuitive and sectioned.
5. **More + unique tags via a dropdown.** *"More unique tags. Dropdown list should be included with that."* → a richer, curated tag set in a **branded dropdown** (anime-flavored: genres, sub/dub, "binge-watcher", "manga reader", waifu/husbando, tier-list-maker, etc. — go creative) + custom tags. Tints are good (keep).
6. **Fix the consent dead-end (real bug).** *"The tints don't seem to work since you can't accept the community rules… There should be a popup to accept community rules in the account, its dumb for users to have to go comment to accept the terms."* → a **branded consent popup right in the account** when a user hits a gated feature (background upload, etc.) — they accept the rules in place, no need to go post a comment first. (The `acceptRules` CF already exists — wire the account modal to it.)
7. **Unique UI + animations everywhere.** Tasteful motion on the new surfaces (reduced-motion safe, compositor-cheap, Firefox-Profiler discipline). Make it feel alive and bespoke — not a template.

## Go-all-out latitude
"More design opportunities and a way to flesh out a person" — propose + build the social-platform touches that make a profile feel real and complete (a richer profile header, a featured strip, better empty states that invite customization, a cohesive settings information-architecture). Keep it clean; keep the heart.

## Verify
ALL tracks green + updated/new specs (the consent-in-account flow, the per-section surfaces, the viewer-preview, the tag dropdown, heart invariants intact — Appreciate still the only count, gold still Blake-only). **5-agent adversarial review** — lenses: the in-account consent wiring (can't be self-attested — still CF-only), the upload/background surface (unchanged protections), heart, privacy (public-view vs edit-view leaks nothing private), perf (new animations). Walk it yourself (Storage emulator up). Then Blake's numbered smoke.

## Report (lean): the design vision (1 para) · per-item (1-7) · the consent-in-account fix · the new section information-architecture · adversarial findings · checkpoint hash · test counts · Blake's numbered smoke. NO deploy.
