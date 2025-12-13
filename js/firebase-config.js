// File: js/firebase-config.js
// ▼▼▼ GANTI DENGAN KONFIGURASI DARI KONSOL FIREBASE ANDA ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyD5dhh4a3835uJGxxvKL27KcTAtu0f7bT4",
  authDomain: "all-auth-1509.firebaseapp.com",
  projectId: "all-auth-1509",
  storageBucket: "all-auth-1509.firebasestorage.app",
  messagingSenderId: "23681152443",
  appId: "1:23681152443:web:8f86c9b89e14c90692809e",
};

// INITIALIZE FIREBASE GLOBAL
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized via config.");
} else if (typeof firebase === 'undefined') {
    console.error("Firebase SDK not loaded before config!");
}
// ▲▲▲ GANTI DENGAN KONFIGURASI DARI KONSOL FIREBASE ANDA ▲▲▲