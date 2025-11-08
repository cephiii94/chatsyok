// File: netlify/functions/set-admin-role.js
// PENTING: Panggil fungsi ini SEKALI SAJA secara manual (misal: lewat browser)
// untuk mendaftarkan user sebagai admin.
// Contoh: https://alamat-netlify-anda.netlify.app/.netlify/functions/set-admin-role?email=cecephard12@gmail.com&key=KUNCI_RAHASIA_ANDA

const admin = require('firebase-admin');

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Gagal inisialisasi Firebase Admin:", e);
  }
}

// Ambil kunci rahasia dari Netlify Environment Variables
// Pastikan Anda mendaftarkan ADMIN_SET_KEY di Netlify
const ADMIN_KEY = process.env.ADMIN_SET_KEY;

if (!ADMIN_KEY) {
  console.error("FATAL: ADMIN_SET_KEY tidak diatur di Netlify.");
}

exports.handler = async (event, context) => {
  const { email, key } = event.queryStringParameters;

  if (!ADMIN_KEY) {
     return { statusCode: 500, body: 'Fungsi admin tidak terkonfigurasi di server.' };
  }

  if (key !== ADMIN_KEY) {
    return { statusCode: 401, body: 'Kunci admin tidak valid.' };
  }

  if (!email) {
    return { statusCode: 400, body: 'Parameter email tidak ditemukan.' };
  }

  try {
    // 1. Cari user berdasarkan email
    const user = await admin.auth().getUserByEmail(email);
    
    // 2. Set Custom Claim { admin: true }
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    console.log(`Berhasil! User ${email} (UID: ${user.uid}) sekarang adalah admin.`);
    return {
      statusCode: 200,
      body: `Berhasil! User ${email} (UID: ${user.uid}) sekarang adalah admin.`
    };

  } catch (error) {
    console.error("Error saat mengatur peran admin:", error);
    return { statusCode: 500, body: `Error: ${error.message}` };
  }
};