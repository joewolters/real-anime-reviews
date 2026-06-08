// firebase.js — single ES module (no <script> tags here)

// Use ONE version everywhere
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, connectAuthEmulator }      from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Paste YOUR config from the console:
const firebaseConfig = {
  apiKey: "AIzaSyCu0ZzrxHGX1pYQNX8WWMUtIpCc8M0Z5Nc",
  authDomain: "real-anime-reviews.firebaseapp.com",
  projectId: "real-anime-reviews",
  storageBucket: "real-anime-reviews.firebasestorage.app",
  messagingSenderId: "1037089894024",
  appId: "1:1037089894024:web:f17b3dfa9b4bb0093c393d",
  measurementId: "G-41ZT1G65LJ"   // not used right now, fine to leave
};

// Initialize ONCE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── GATE 4 practice mode ───────────────────────────────────────────────────
// Opt-in ONLY: point the client SDK at the LOCAL Firebase emulators so Blake can
// smoke community features in a sandbox (production is never the target for the
// staged v1.9.0 rules). Enabled by `?emu=1` (sticky via localStorage), turned off
// by `?emu=0`, and HARD-restricted to localhost so it can NEVER fire on
// realanimereviews.com. See docs/DEPLOYMENT.md § Practice mode.
(function maybeUseEmulators() {
  try {
    const host = location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (!isLocal) return; // production-safe: emulators only ever on localhost
    const params = new URLSearchParams(location.search);
    if (params.get("emu") === "0") { localStorage.removeItem("rar:useEmulators"); return; }
    if (params.has("emu")) localStorage.setItem("rar:useEmulators", "1");
    if (localStorage.getItem("rar:useEmulators") !== "1") return;
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    window.RAR_PRACTICE_MODE = true;
    console.log("🔧 PRACTICE MODE — connected to local Firebase emulators (auth:9099, firestore:8080)");
  } catch (e) {
    console.warn("practice-mode emulator connect skipped:", e && e.message);
  }
})();

// Export for script.js
export { app, auth, db };

window.auth = auth;
window.db = db;

console.log("✅ Firebase initialized");
