// firebase.js — single ES module (no <script> tags here)

// Use ONE version everywhere
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

// Export for script.js
export { app, auth, db };

window.auth = auth;
window.db = db;

console.log("✅ Firebase initialized");
