// File: netlify/functions/get-character.js

const admin = require('firebase-admin');

// 1. Ambil kredensial rahasia dari Netlify Environment
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// 2. Inisialisasi Firebase Admin (hanya jika belum ada)
// Ini mencegah inisialisasi ganda saat 'hot-reloading'
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// 3. Inisialisasi Firestore
const db = admin.firestore();

// 4. Ini adalah 'handler' function-nya
exports.handler = async (event, context) => {
  // Ambil 'id' dari query URL (misal: /.../get-character?id=1)
  const characterId = event.queryStringParameters.id || '1'; // Default '1'

  try {
    const docRef = db.collection('characters').doc(characterId);
    const docSnap = await docRef.get();

    let characterData;

    if (docSnap.exists()) {
      characterData = docSnap.data();
    } else {
      // Jika ID tidak ada, ambil data default '1'
      console.warn(`ID ${characterId} tidak ditemukan, mengambil default.`);
      const defaultSnap = await db.collection('characters').doc('1').get();
      if (defaultSnap.exists()) {
        characterData = defaultSnap.data();
      } else {
        // Error parah jika '1' pun tidak ada
        throw new Error("Karakter default (ID: 1) tidak ditemukan.");
      }
    }

    // 5. Kirim data sebagai JSON
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(characterData)
    };

  } catch (error) {
    console.error("Error di Netlify Function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal mengambil data karakter." })
    };
  }
};