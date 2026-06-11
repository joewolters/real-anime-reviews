// cropper.js (ES module) — the ONE pan/zoom crop dialog for profile images.
// =============================================================================
// v1.10.0 round 4, Blake item 2: "After a user clicks a picture they should be
// able to resize or move the circle around that shows what their profile will
// look like. Like a modern social media app." Before this, the avatar / profile
// background pickers center-cropped blindly (account.js downscaleImage) — the
// user had zero say in WHAT part of the image survived.
//
// Conventions follow consent.js: branded modal (NO native dialogs, ever),
// purple-only (this is a community-member surface — gold is Blake's alone),
// remove-the-node-on-close (no [hidden] symmetry needed), Esc/backdrop/✕ all
// cancel. CSS self-injects ONCE as <style id="rar-cropper-css"> so account.js
// only has to import { openCropper } and call it.
//
// API (account.js depends on EXACTLY this):
//   openCropper({ file, mode }) → Promise<{ blob, mime } | null>
//     file: File/Blob (image/jpeg|png|webp — the caller keeps GIFs away)
//     mode: 'avatar' (320×320 stage, Ø280 circle mask, 512×512 square out)
//         | 'background' (480×360 stage, full-bleed 4:3 mask, ≤1280w out —
//           gate 20.6: 4:3 matches the real card window; 16:9 chopped sides)
//     null = cancelled (Esc, backdrop, ✕, Cancel). {blob,mime} = Apply.
//
// The circle is PRESENTATIONAL: the avatar output is the circle's bounding
// SQUARE (the site renders avatars round). Mime mirrors downscaleImage's
// policy: PNG in → image/png out (keeps transparency); else image/jpeg @ 0.9.
// Background output is never upscaled past the source pixels (≤1280 wide).
//
// TESTABILITY (the lanternModel precedent): window.cropperModel.coverClamp is
// the PURE pan/zoom clamp math — the same function the UI calls every frame —
// so a Playwright spec can pin the geometry without driving pointer events.
// =============================================================================

const MAX_ZOOM = 4;          // slider/wheel ceiling = 4× the cover scale
const JPEG_QUALITY = 0.9;    // mirrors account.js downscaleImage

let _openNow = false;        // double-open guard: second call resolves null

// ── PURE testable model (exposed on window for Playwright) ──────────────────
// The image is drawn at `scale` (image px × scale = view px) with its top-left
// at (x, y) in CROP-REGION coordinates (the region the output is cut from:
// 280×280 for avatar, 480×360 for background). "Cover" means the scaled image
// must fully blanket that region — no blank edges ever show inside the mask:
//   x ∈ [viewW − imgW·s, 0]   y ∈ [viewH − imgH·s, 0]   s ≥ minScale
// Returns the clamped {x, y} plus minScale (= the cover-fit scale). If the
// caller passes scale < minScale the clamp is computed AT minScale, so the
// caller can read .minScale back and correct its own scale.
export function coverClamp(imgW, imgH, viewW, viewH, scale, x, y) {
  const iw = Number(imgW) || 0, ih = Number(imgH) || 0;
  const vw = Number(viewW) || 0, vh = Number(viewH) || 0;
  if (iw <= 0 || ih <= 0 || vw <= 0 || vh <= 0) return { x: 0, y: 0, minScale: 1 };
  const minScale = Math.max(vw / iw, vh / ih);
  const s = Math.max(Number(scale) || 0, minScale);
  const cx = Math.min(0, Math.max(vw - iw * s, Number(x) || 0));
  const cy = Math.min(0, Math.max(vh - ih * s, Number(y) || 0));
  return { x: cx, y: cy, minScale };
}
if (typeof window !== 'undefined') window.cropperModel = { coverClamp };

// ── per-mode geometry ────────────────────────────────────────────────────────
// crop = the output region inside the stage. The avatar stage carries a 20px
// gutter so the dimmed ring around the circle is visible; the background mask
// is full-bleed (only the rounded corner slivers dim).
const GEOM = {
  avatar: {
    stageW: 320, stageH: 320,
    crop: { x: 20, y: 20, w: 280, h: 280 },
    outW: 512, outH: 512, fixedOut: true,
    title: 'Frame it', jp: '切り取り', aria: 'Crop your avatar',
  },
  background: {
    // gate 20.6 (Blake item 1a) — the stage was 16:9 while every render surface
    // (the account hero, the public sheet) is a ~4:3-ish card painted with
    // object-fit:cover, so the render systematically chopped the sides of what
    // the preview promised. 4:3 capture ≈ the real card window; cover's residual
    // trim is small and center-anchored.
    stageW: 480, stageH: 360,
    crop: { x: 0, y: 0, w: 480, h: 360 },
    outW: 1280, outH: 960, fixedOut: false,
    title: 'Frame the night', jp: '切り取り', aria: 'Crop your profile background',
  },
};
// bgAspect exposed for the g25 spec — the 4:3 capture IS the gate-20.6 item-1a
// fix; derived from GEOM so the spec and the geometry can't drift apart.
if (typeof window !== 'undefined') {
  window.cropperModel.bgAspect = GEOM.background.crop.w / GEOM.background.crop.h;
}

// ── self-injected styles (idempotent; purple family ONLY — never gold) ──────
function injectCss() {
  if (document.getElementById('rar-cropper-css')) return;
  const style = document.createElement('style');
  style.id = 'rar-cropper-css';
  style.textContent = `
.crp-overlay {
  position: fixed; inset: 0; z-index: 7200; background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center;
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
}
.crp-card {
  width: min(560px, 94vw); max-height: 92vh; overflow: auto;
  background: linear-gradient(180deg, rgba(40,12,72,.98), rgba(24,6,46,.98));
  border: 1px solid rgba(187,134,252,.4); border-top: 3px solid #bb86fc;
  border-radius: 14px; padding: 18px 20px 16px;
  box-shadow: 0 0 30px rgba(187,134,252,.45);
  animation: crpCardIn .18s ease both;
}
@keyframes crpCardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.crp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.crp-kicker { margin: 0 0 3px; display: flex; align-items: center; gap: 8px;
  font: 800 .92rem 'Montserrat', sans-serif; letter-spacing: .16em; text-transform: uppercase;
  color: #f6efff; text-shadow: 0 0 20px rgba(187,134,252,.55); }
.crp-kicker .jp-mini { font-size: .72rem; color: #cbb0ff; opacity: .85; letter-spacing: normal; }
.crp-x { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 9px; cursor: pointer;
  background: rgba(187,134,252,.1); border: 1px solid rgba(187,134,252,.45);
  color: #e9dbff; font-size: .95rem; line-height: 1; }
.crp-x:hover { background: rgba(187,134,252,.22); color: #fff; }
.crp-sub { margin: 0 0 12px; color: #b8a8d8; font-size: .76rem; }
.crp-stage-wrap { display: flex; justify-content: center; }
.crp-stage { display: block; max-width: 100%; height: auto; border-radius: 12px;
  background: rgba(10,2,22,.85); border: 1px solid rgba(187,134,252,.3);
  touch-action: none; cursor: grab; }
.crp-stage.is-dragging { cursor: grabbing; }
.crp-zoom-row { display: flex; align-items: center; gap: 10px; margin: 14px 2px 0; }
.crp-zoom-label { font: 800 .62rem 'Montserrat', sans-serif; letter-spacing: .14em;
  text-transform: uppercase; color: #cbb0ff; flex: 0 0 auto; }
.crp-zoom { flex: 1 1 auto; accent-color: #bb86fc; }
.crp-error { margin: 8px 0 0; min-height: 1.1em; color: #ffb4b4; font-size: .8rem; }
.crp-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
.crp-btn { padding: 8px 16px; border-radius: 10px; cursor: pointer;
  font: 600 .85rem 'Montserrat', sans-serif; color: #d9c9ff;
  background: rgba(255,255,255,.05); border: 1px solid rgba(187,134,252,.35); }
.crp-btn:hover { background: rgba(187,134,252,.12); color: #fff; }
.crp-apply { background: rgba(187,134,252,.22); border-color: rgba(187,134,252,.6); color: #fff; }
.crp-apply:hover { filter: brightness(1.08); box-shadow: 0 8px 20px rgba(120,40,200,.5);
  border-color: rgba(187,134,252,.85); }
.crp-apply:disabled, .crp-apply[aria-disabled="true"] { opacity: .55; cursor: default;
  filter: none; box-shadow: none; }
@media (prefers-reduced-motion: reduce) {
  .crp-card { animation: none; }
  .crp-overlay { -webkit-backdrop-filter: none; backdrop-filter: none; }
}`;
  document.head.appendChild(style);
}

// ── image decode: createImageBitmap first, objectURL <img> fallback, then a
// FileReader dataURL last resort. Returns { src, w, h, cleanup } or null. ────
function loadImgEl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}
async function loadSource(file) {
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file);
      if (bmp && bmp.width > 0 && bmp.height > 0) {
        return { src: bmp, w: bmp.width, h: bmp.height, cleanup: () => { try { bmp.close(); } catch (_) {} } };
      }
    }
  } catch (_) { /* fall through to the URL path */ }
  let url = '';
  try {
    url = URL.createObjectURL(file);
    const img = await loadImgEl(url);
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      // revoke on cleanup (not before): the decoded pixels outlive the URL.
      return { src: img, w: img.naturalWidth, h: img.naturalHeight, cleanup: () => { try { URL.revokeObjectURL(url); } catch (_) {} } };
    }
    URL.revokeObjectURL(url);
  } catch (_) { if (url) { try { URL.revokeObjectURL(url); } catch (_) {} } }
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error || new Error('read failed'));
      fr.readAsDataURL(file);
    });
    const img = await loadImgEl(dataUrl);
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      return { src: img, w: img.naturalWidth, h: img.naturalHeight, cleanup: () => {} };
    }
  } catch (_) { /* unreadable */ }
  return null;
}

// canvas roundRect helper (own path math — ctx.roundRect is too new to lean on)
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ── the dialog ───────────────────────────────────────────────────────────────
export async function openCropper({ file, mode } = {}) {
  if (_openNow) return null;               // never throw on double-open
  if (!file || typeof document === 'undefined') return null;
  _openNow = true;
  injectCss();

  const geom = GEOM[mode] || GEOM.avatar;
  const CROP = geom.crop;
  const dpr = Math.max(1, Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  const prevFocus = document.activeElement;

  return new Promise((resolve) => {
    try {
    document.querySelectorAll('.crp-overlay').forEach((n) => n.remove());
    const overlay = document.createElement('div');
    overlay.className = 'crp-overlay';
    overlay.innerHTML = `
      <div class="crp-card" role="dialog" aria-modal="true" aria-label="${geom.aria}">
        <div class="crp-head">
          <h3 class="crp-kicker">${geom.title} <span class="jp-mini">${geom.jp}</span></h3>
          <button type="button" class="crp-x" aria-label="Cancel crop">✕</button>
        </div>
        <p class="crp-sub">Drag to move · wheel or pinch to zoom · arrow keys nudge (Shift = big steps), + / − zoom</p>
        ${geom === GEOM.background ? '<p class="crp-sub">The soft shading top and bottom is where your card’s text sits — the picture itself keeps its full brightness.</p>' : ''}
        <div class="crp-stage-wrap">
          <canvas class="crp-stage" tabindex="0" aria-label="Crop preview — drag or use the arrow keys to position your image"></canvas>
        </div>
        <div class="crp-zoom-row">
          <span class="crp-zoom-label" id="crp-zoom-label">Zoom</span>
          <input class="crp-zoom" type="range" min="0" max="100" step="1" value="0" aria-labelledby="crp-zoom-label">
        </div>
        <p class="crp-error" role="alert"></p>
        <div class="crp-actions">
          <button type="button" class="crp-btn crp-cancel">Cancel</button>
          <button type="button" class="crp-btn crp-apply">Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const card = overlay.querySelector('.crp-card');
    const canvas = overlay.querySelector('.crp-stage');
    const slider = overlay.querySelector('.crp-zoom');
    const errEl = overlay.querySelector('.crp-error');
    const applyBtn = overlay.querySelector('.crp-apply');
    const cancelBtn = overlay.querySelector('.crp-cancel');
    const xBtn = overlay.querySelector('.crp-x');

    canvas.width = geom.stageW * dpr;
    canvas.height = geom.stageH * dpr;
    canvas.style.width = geom.stageW + 'px';
    const ctx = canvas.getContext('2d');
    // the preview caps (background mode) — built ONCE; geometry is fixed for
    // the dialog's lifetime and paint() runs on every drag/zoom frame.
    const capTop = ctx.createLinearGradient(0, 0, 0, geom.stageH);
    capTop.addColorStop(0, 'rgba(14,4,30,.50)');
    capTop.addColorStop(0.26, 'rgba(14,4,30,0)');
    capTop.addColorStop(1, 'rgba(14,4,30,0)');
    const capFloor = ctx.createLinearGradient(0, geom.stageH, 0, 0);
    capFloor.addColorStop(0, 'rgba(14,4,30,.88)');
    capFloor.addColorStop(0.22, 'rgba(14,4,30,.45)');
    capFloor.addColorStop(0.52, 'rgba(14,4,30,0)');
    capFloor.addColorStop(1, 'rgba(14,4,30,0)');

    // mutable view state — coverClamp (the exposed pure model) governs it.
    const state = { scale: 1, minScale: 1, x: 0, y: 0 };
    let img = null;          // { src, w, h, cleanup }
    let loadFailed = false;
    let settled = false;

    const done = (val) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown);
      if (img) { try { img.cleanup(); } catch (_) {} img = null; }
      try { overlay.remove(); } catch (_) {}
      // restore focus to wherever the user was (a11y: the picker button)
      if (prevFocus && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus(); } catch (_) {}
      }
      _openNow = false;
      resolve(val);
    };

    // ── painting ──
    function maskPath() {
      if (geom === GEOM.avatar) {
        ctx.arc(geom.stageW / 2, geom.stageH / 2, CROP.w / 2, 0, Math.PI * 2);
      } else {
        roundRectPath(ctx, 1, 1, geom.stageW - 2, geom.stageH - 2, 14);
      }
    }
    function paint() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, geom.stageW, geom.stageH);
      if (img) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img.src, CROP.x + state.x, CROP.y + state.y, img.w * state.scale, img.h * state.scale);
      } else {
        ctx.fillStyle = 'rgba(203,176,255,.8)';
        ctx.font = "600 13px 'Montserrat', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(loadFailed ? '' : 'Loading…', geom.stageW / 2, geom.stageH / 2);
      }
      // gate 20.6 (Blake item 1) — preview = render: the card paints two
      // localized caps over the background (style.css .profile-bg-wrap::after /
      // .acct-preview-bg::after — keep the stops in sync), so the FRAME-IT
      // preview paints the SAME caps. What you see here is what appears.
      // (the gradients are hoisted — paint() runs per pointermove frame)
      if (img && geom === GEOM.background) {
        ctx.fillStyle = capTop;
        ctx.fillRect(0, 0, geom.stageW, geom.stageH);
        ctx.fillStyle = capFloor;
        ctx.fillRect(0, 0, geom.stageW, geom.stageH);
      }
      // dim everything OUTSIDE the mask (evenodd punch), then the purple edge
      ctx.beginPath();
      ctx.rect(0, 0, geom.stageW, geom.stageH);
      maskPath();
      ctx.fillStyle = 'rgba(6,1,14,.66)';
      ctx.fill('evenodd');
      ctx.beginPath();
      maskPath();
      ctx.strokeStyle = 'rgba(187,134,252,.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function syncSlider() {
      const t = (state.scale / state.minScale - 1) / (MAX_ZOOM - 1);
      slider.value = String(Math.round(Math.min(1, Math.max(0, t)) * 100));
    }
    function refresh(sync = true) {
      if (img) {
        const c = coverClamp(img.w, img.h, CROP.w, CROP.h, state.scale, state.x, state.y);
        state.minScale = c.minScale;
        if (state.scale < c.minScale) state.scale = c.minScale;
        state.x = c.x;
        state.y = c.y;
      }
      paint();
      if (sync) syncSlider();
    }

    // ── zoom core (anchored so the point under the cursor/pinch stays put) ──
    function zoomAt(target, p) {
      const lo = state.minScale, hi = state.minScale * MAX_ZOOM;
      const s1 = Math.min(hi, Math.max(lo, target));
      const s0 = state.scale;
      if (!s0 || s1 === s0) return;
      state.x = p.x - (p.x - state.x) * (s1 / s0);
      state.y = p.y - (p.y - state.y) * (s1 / s0);
      state.scale = s1;
    }
    const cropCenter = () => ({ x: CROP.w / 2, y: CROP.h / 2 });

    // client coords → crop-region coords (handles CSS downscaling on small screens)
    function stagePoint(e) {
      const r = canvas.getBoundingClientRect();
      const fx = r.width ? geom.stageW / r.width : 1;
      const fy = r.height ? geom.stageH / r.height : 1;
      return { x: (e.clientX - r.left) * fx - CROP.x, y: (e.clientY - r.top) * fy - CROP.y };
    }

    // ── pointer pan + 2-pointer pinch ──
    const pointers = new Map();
    canvas.addEventListener('pointerdown', (e) => {
      if (!img) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      pointers.set(e.pointerId, stagePoint(e));
      canvas.classList.add('is-dragging');
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!img || !pointers.has(e.pointerId)) return;
      const p = stagePoint(e);
      const prev = pointers.get(e.pointerId);
      if (pointers.size >= 2) {
        const otherId = [...pointers.keys()].find((id) => id !== e.pointerId);
        const other = pointers.get(otherId);
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(p.x - other.x, p.y - other.y);
        const mid = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
        const prevMid = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
        state.x += mid.x - prevMid.x;   // the pinch midpoint also pans
        state.y += mid.y - prevMid.y;
        if (d0 > 0) zoomAt(state.scale * (d1 / d0), mid);
      } else {
        state.x += p.x - prev.x;
        state.y += p.y - prev.y;
      }
      pointers.set(e.pointerId, p);
      refresh();
    });
    const endPointer = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) canvas.classList.remove('is-dragging');
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    // ── wheel zooms toward the cursor (passive:false — it preventDefaults) ──
    canvas.addEventListener('wheel', (e) => {
      if (!img) return;
      e.preventDefault();
      const k = e.deltaMode === 1 ? 0.05 : 0.0015;   // line-mode vs pixel-mode
      zoomAt(state.scale * Math.exp(-e.deltaY * k), stagePoint(e));
      refresh();
    }, { passive: false });

    // ── slider zooms about the crop center ──
    slider.addEventListener('input', () => {
      if (!img) return;
      const t = Number(slider.value) / 100;
      zoomAt(state.minScale * (1 + (MAX_ZOOM - 1) * t), cropCenter());
      refresh(false);   // don't fight the thumb the user is holding
    });

    // ── keyboard: Esc cancel, Tab trap, arrows nudge, +/- zoom ──
    const focusables = () => [xBtn, canvas, slider, cancelBtn, applyBtn].filter((el) => el && !el.disabled);
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        // stopPropagation: the anime-modal Esc handler lives on `window`
        // (consent.js precedent) — don't also close what's underneath.
        e.stopPropagation();
        e.preventDefault();
        done(null);
        return;
      }
      if (e.key === 'Tab') {
        const list = focusables();
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        return;
      }
      if (!img) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(state.scale * 1.12, cropCenter()); refresh(); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(state.scale / 1.12, cropCenter()); refresh(); return; }
      if (e.target === slider) return;   // arrows on the slider = native zoom steps
      const step = e.shiftKey ? 32 : 8;
      switch (e.key) {
        case 'ArrowLeft':  state.x -= step; break;
        case 'ArrowRight': state.x += step; break;
        case 'ArrowUp':    state.y -= step; break;
        case 'ArrowDown':  state.y += step; break;
        default: return;
      }
      e.preventDefault();
      refresh();
    };
    document.addEventListener('keydown', onKeyDown);

    // ── cancel paths (all resolve null) ──
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });
    cancelBtn.addEventListener('click', () => done(null));
    xBtn.addEventListener('click', () => done(null));

    // ── Apply → cut the crop region out of the SOURCE pixels ──
    async function renderOutput() {
      try {
        const s = state.scale;
        const sx = -state.x / s, sy = -state.y / s;        // crop origin in image px
        const sw = CROP.w / s, sh = CROP.h / s;
        let ow, oh;
        if (geom.fixedOut) { ow = geom.outW; oh = geom.outH; }
        else {
          ow = Math.min(geom.outW, Math.max(1, Math.round(sw)));   // never upscale
          oh = Math.max(1, Math.round(ow * (CROP.h / CROP.w)));
        }
        const out = document.createElement('canvas');
        out.width = ow;
        out.height = oh;
        const octx = out.getContext('2d');
        const mime = (file.type || '').includes('png') ? 'image/png' : 'image/jpeg';
        if (mime === 'image/jpeg') {                       // alpha (webp) → dark base, not black
          octx.fillStyle = '#0e041e';
          octx.fillRect(0, 0, ow, oh);
        }
        octx.imageSmoothingEnabled = true;
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(img.src, sx, sy, sw, sh, 0, 0, ow, oh);
        const blob = await new Promise((res) => {
          try { out.toBlob(res, mime, JPEG_QUALITY); } catch (_) { res(null); }
        });
        return blob ? { blob, mime } : null;
      } catch (_) { return null; }
    }
    applyBtn.addEventListener('click', async () => {
      if (!img || applyBtn.getAttribute('aria-disabled') === 'true') return;
      applyBtn.setAttribute('aria-disabled', 'true');
      errEl.textContent = '';
      const result = await renderOutput();
      if (settled) return;
      if (!result) {
        applyBtn.removeAttribute('aria-disabled');
        errEl.textContent = "Couldn't crop that image — try a different file.";
        return;
      }
      done(result);
    });

    // open state: focus Apply (kept focusable while loading; the click guards)
    applyBtn.setAttribute('aria-disabled', 'true');
    try { applyBtn.focus(); } catch (_) {}
    paint();   // "Loading…" under the mask

    // ── decode, then initial fit = cover + centered ──
    loadSource(file).then((loaded) => {
      if (settled) { if (loaded) { try { loaded.cleanup(); } catch (_) {} } return; }
      if (!loaded) {
        loadFailed = true;
        errEl.textContent = "Couldn't read that image — try a different file.";
        applyBtn.disabled = true;        // Apply is dead; Cancel still works
        try { cancelBtn.focus(); } catch (_) {}
        paint();
        return;
      }
      img = loaded;
      const c = coverClamp(img.w, img.h, CROP.w, CROP.h, 0, 0, 0);
      state.minScale = c.minScale;
      state.scale = c.minScale;
      state.x = (CROP.w - img.w * state.scale) / 2;
      state.y = (CROP.h - img.h * state.scale) / 2;
      applyBtn.removeAttribute('aria-disabled');
      refresh();
    });
    } catch (e) {
      // adversarial LOW: a throw anywhere in setup left _openNow latched true
      // and every later picker silently "cancelled" until a reload.
      _openNow = false;
      try { document.querySelectorAll('.crp-overlay').forEach((n) => n.remove()); } catch (_) {}
      resolve(null);
    }
  });
}
