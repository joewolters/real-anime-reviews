// admin/chat-drawer.js — shared ✨ ASK drawer controller (classic script → window.RarChatDrawer).
// <!-- author: Code | date: 2026-06-04 -->
// v1.8.1 (gate 4) — the Haiku assistant drawer, factored out so the edit page mounts
// the SAME drawer new-anime pioneered: identical markup/classes (.chat-*), the same
// /api/chat backend, the same per-anime sessionStorage (rar:chat:<aniListId>). The
// host page supplies a getSession() → { id, context } so the only difference between
// surfaces is WHERE the anime context comes from (AniList state vs animeData row).
// (new-anime keeps its proven inline copy for now; it can converge onto this later.)
(function () {
  const $ = (id) => document.getElementById(id);
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  function mount(opts) {
    opts = opts || {};
    const ENDPOINT = opts.endpoint || '/api/chat';
    const getSession = typeof opts.getSession === 'function' ? opts.getSession : () => null;

    let messages = [];
    let currentId = null;
    let currentContext = null;

    function key() { return currentId ? `rar:chat:${currentId}` : null; }
    function load() {
      messages = [];
      const k = key();
      if (!k) return;
      try { const raw = sessionStorage.getItem(k); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) messages = arr.filter(m => !m.pending); } } catch (_) {}
    }
    function persist() {
      const k = key();
      if (!k) return;
      try { sessionStorage.setItem(k, JSON.stringify(messages.filter(m => !m.pending))); } catch (_) {}
    }
    function clear() { const k = key(); messages = []; if (k) { try { sessionStorage.removeItem(k); } catch (_) {} } render(); }

    function isOpen() { const d = $('chat-drawer'); return !!(d && d.classList.contains('open')); }
    function openDrawer() {
      const d = $('chat-drawer');
      if (!d || !currentId) return;
      d.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('open')));
      $('chat-summon-btn') && $('chat-summon-btn').setAttribute('aria-expanded', 'true');
      render();
      $('chat-input') && $('chat-input').focus();
    }
    function closeDrawer() {
      const d = $('chat-drawer');
      if (!d) return;
      d.classList.remove('open');
      $('chat-summon-btn') && $('chat-summon-btn').setAttribute('aria-expanded', 'false');
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) d.hidden = true;
      else setTimeout(() => { if (!d.classList.contains('open')) d.hidden = true; }, 280);
    }

    function render() {
      const thread = $('chat-thread');
      const empty = $('chat-empty');
      if (!thread) return;
      const msgs = messages || [];
      if (empty) empty.hidden = msgs.length > 0;
      thread.innerHTML = msgs.map((m, i) => {
        if (m.pending) return '<div class="chat-msg chat-msg--assistant"><div class="chat-bubble"><span class="chat-dots"><i></i><i></i><i></i></span></div></div>';
        if (m.error) {
          const retry = m.retry ? ` <button type="button" class="chat-retry" data-retry="${i}">Retry</button>` : '';
          return `<div class="chat-msg chat-msg--assistant"><div class="chat-bubble chat-bubble--error">${escapeHtml(m.content)}${retry}</div></div>`;
        }
        const cls = m.role === 'user' ? 'chat-msg chat-msg--user' : 'chat-msg chat-msg--assistant';
        return `<div class="${cls}"><div class="chat-bubble">${escapeHtml(m.content).replace(/\n/g, '<br>')}</div></div>`;
      }).join('');
      thread.scrollTop = thread.scrollHeight;
    }

    async function callApi() {
      messages.push({ role: 'assistant', pending: true });
      render();
      const apiMessages = messages.filter(m => !m.pending && !m.error).map(m => ({ role: m.role, content: m.content }));
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, animeContext: currentContext || {} }),
        });
        messages = messages.filter(m => !m.pending);
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          // v1.10.2 — friendly copy only: raw server errors / status codes never
          // reach the drawer. A JSON error body means Mode 1 answered and hit a
          // snag; anything else (e.g. the deployed site's 404 page for /api/chat)
          // means Mode 1 isn't reachable from here.
          let msg;
          if (/API_KEY/i.test(b.error || '')) {
            msg = 'The assistant key is missing from .env on the desktop — add it, then restart Mode 1.';
          } else if (b.error) {
            msg = 'The assistant hit a snag — please try again.';
          } else {
            msg = 'The assistant needs Mode 1 running on the desktop — double-click MODE 1, then try again.';
          }
          messages.push({ role: 'assistant', error: true, retry: true, content: msg });
        } else {
          const data = await res.json();
          messages.push({ role: 'assistant', content: data.text || '(no response)' });
        }
      } catch (_) {
        messages = messages.filter(m => !m.pending);
        messages.push({ role: 'assistant', error: true, retry: true, content: 'The assistant needs Mode 1 running on the desktop — double-click MODE 1, then try again.' });
      }
      render();
      persist();
    }

    function send(text) {
      text = (text || '').trim();
      if (!text || !currentId) return;
      messages.push({ role: 'user', content: text });
      persist();
      callApi();
    }
    function retry() {
      while (messages.length && messages[messages.length - 1].error) messages.pop();
      persist();
      callApi();
    }

    // ---- one-time wiring (the host page provides the markup before mount) ----
    $('chat-summon-btn') && $('chat-summon-btn').addEventListener('click', openDrawer);
    $('chat-close-btn') && $('chat-close-btn').addEventListener('click', closeDrawer);
    $('chat-clear-btn') && $('chat-clear-btn').addEventListener('click', clear);
    const form = $('chat-input-row');
    form && form.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('chat-input'); if (!inp) return;
      const v = inp.value; inp.value = ''; inp.style.height = 'auto';
      send(v);
    });
    const input = $('chat-input');
    input && input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (form && form.requestSubmit) form.requestSubmit();
        else { const v = input.value; input.value = ''; send(v); }
      }
    });
    input && input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
    const drawer = $('chat-drawer');
    drawer && drawer.addEventListener('click', (e) => {
      const qs = e.target.closest('[data-quickstart]');
      if (qs) { send(qs.dataset.quickstart); return; }
      if (e.target.closest('[data-retry]')) { retry(); return; }
    });

    // ---- controller for the host page ----
    return {
      // Call whenever the loaded anime changes (or clears): re-keys storage, reloads
      // that anime's history, enables/disables the ✨ ASK summon, closes if cleared.
      setAnime() {
        const s = getSession();
        currentId = s && s.id ? s.id : null;
        currentContext = s && s.context ? s.context : null;
        const btn = $('chat-summon-btn');
        if (btn) btn.disabled = !currentId;
        load();
        render();
        if (!currentId) closeDrawer();
      },
      isOpen,
      close: closeDrawer,
    };
  }

  window.RarChatDrawer = { mount };
})();
