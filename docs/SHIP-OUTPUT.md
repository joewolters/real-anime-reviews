<!-- author: Code | date: 2026-07-02 -->
# THE MEGA-RUN — Report 2: picks locked in, the messaging foundations are BUILT (gates A0 + A1). Sandbox-staged; nothing touches prod before your single go.

Your picks are running the show now: **one mega-cutover, one final smoke** — so everything below was verified by my own hands at full discipline (test tracks, live walks, the works), and you won't be asked to look at anything until the one comprehensive smoke at the end. The door-line copy approval rides that final smoke.

## Gate A0 — the notification engine is ONE machine now
The site had two copies of the Lantern (index and account pages) that had already drifted apart — one was missing a mute control the other had. Every DM feature this run adds would have needed the same work done twice, drifting further. Now there's one module; the index page plugs its page-specific behavior in through five small hooks. ~450 duplicated lines deleted, four new structural tests pin it so the twin can never come back, and I walked it live: the gold ember lights for your pings, the who-liked drill-down works, closing the center puts the light out.

## Gate A1 — the safety layer peer DMs stand on (built BEFORE any chat UI exists)
The design study found the "blocks" system the old notes claimed was live **never existed** — so it exists now, and it's tested from 30 angles:
- **Blocking is invisible and unconditional.** A blocked person can never confirm they're blocked (they just can't start a conversation — the copy will say "can't message this member", nothing more). Blocking works even for banned members — self-protection is never gated.
- **Strangers knock first.** A first message creates a REQUEST: you get exactly one quiet notification (deliberately impossible to mute — it's the safety signal), the sender can't generate more pings no matter how much they type, and only the recipient can open or silently decline it.
- **Groups are born small and grow carefully.** A group starts with just its creator; members are added one at a time (each add re-checks blocks both ways), capped at 15, anyone can leave, and nobody can forge the unread counters.
- **Message plumbing:** send-gates (nothing writes into a declined or locked conversation), the image-path shape for DM pictures (gate A4 rides on it), per-conversation mute, and rate brakes — conversation-creation spam stops at 5/min while real chat gets its own 20-messages-a-minute lane (the build agent's first cut shared the forum brake, which would have deleted normal conversation — caught and fixed in-gate).
- The dm_request notification type was a ONE-line, one-place addition — the exact thing gate A0 was for.

## Test state (all green, floors raised)
Playwright **233** · rules **187** (+30 — the whole security layer) · functions **77** · CF triggers **73** (+6) · e2e **16**. Commits `05c9663` + `efb5a17`, pushed.

## What's next (no input needed)
**Gate A2 — THE LETTER ROOM:** the unified inbox itself. The DM-Blake hero card and the locked "People" placeholder die; in their place: a conversation list with a Requests strip, your row in gold among them, the thread view, a ✉ Message button on every profile sheet, and the mute toggle per conversation. Then groups UI (A3), images with the sealed-until-accept chip (A4), and the messaging adversarial panel (A5). Milestone reports keep landing here as each batch closes.

## One-liner reply
Your picks are locked and the run is moving: the notification engine is one machine instead of two drifting copies, and the entire safety layer for peer DMs — blocks that really exist now, knock-first requests that can't spam you, careful little groups, chat-speed rate brakes — is built, 36 new tests green, before a single pixel of chat UI goes up; the Letter Room is next, and nothing reaches the live site until your one big smoke and your single go.
