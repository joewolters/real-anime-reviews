<!-- author: Code | date: 2026-05-10 -->
# AI Integration Design — Mode 1's "✨ AI" buttons

> Planning doc for v1.6.x. Baseline ships with a 2-step copy/paste workaround (panel opens with prompt → "Open Claude →" opens new tab → Blake pastes response back → "Use this" populates field). This doc plans the real one-click integration.

## 1 · What we want

Click "✨ AI" → suggestion appears inline within ~2 seconds → click "Use this" → field populated. No new tab, no copy/paste.

## 2 · Why we don't have it in v1.6.0

Browser fetch to Anthropic's API is CORS-blocked. Without a server intermediary the form can't call Claude programmatically.

## 3 · Three viable paths (recommended → not)

### Option A — Firebase Cloud Function (recommended)

Add a function that proxies: form → function → Anthropic → function → form.

**Setup (one-time):**
1. `firebase init functions` (Node runtime)
2. Write `functions/src/suggestAi.js` (~40 lines): HTTPS callable, validates caller UID === ADMIN_UID, calls Anthropic Messages API, returns text
3. `firebase functions:config:set anthropic.key="sk-..."` (key stored on Firebase, not in repo)
4. `firebase deploy --only functions`
5. Update `admin/new-anime.js` AI panel: replace "Open Claude →" with "Generate" that calls the function

**Pros:** real one-click, key never in browser, UID gate server-side, fits existing Firebase infra, free tier covers personal use, Anthropic Haiku ~$0.25/M tokens (fractions of a cent per use).

**Cons:** Functions setup ceremony with Google Cloud project linking. Adds one more thing that can break.

**Effort:** ~2-3 hours.

### Option B — Local Node "AI proxy" server

Add to existing Mode 1 server (`scripts/mode1-server.js`): new endpoint `/api/ai-suggest` that holds the Anthropic key (in `.env`, gitignored) and proxies requests.

**Pros:** no Cloud Function setup, key never deployed, works offline.
**Cons:** only works on Blake's machine; deployed admin form can't use AI; another env var to manage.

**Effort:** ~1 hour (extending existing server).

### Option C — Stay with v1.6.0 copy/paste workaround

Don't build AI integration. The 2-step flow already works.

**When this is right:** if Blake uses AI suggestions <2 times per month.

## 4 · Recommendation

**Option A (Cloud Function)** if AI suggestions become a regular workflow. Build it as part of v1.6.x polish.

If Anthropic key cost is a blocker: **Option B** is the no-cost fallback, scoped to local-only use.

## 5 · UI is already in place

The `.ai-panel` infrastructure (in `admin/new-anime.css` + `.js`) is ready. When v1.6.x ships, only changes needed:
- Replace "Open Claude →" button with "Generate" (calls function/server)
- Replace paste-back textarea with result-display area
- Add loading spinner while waiting

The "Use this" button stays the same.

## 6 · Out-of-scope

- Other AI providers — sticking with Claude/Anthropic for project consistency.
- Local LLMs (Ollama) — too much setup, lower quality.
- Browser-based LLMs (WebLLM, transformers.js) — quality not worth the trade-off.
