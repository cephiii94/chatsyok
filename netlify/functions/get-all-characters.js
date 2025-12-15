// File: netlify/functions/get-all-characters.js

const admin = require('firebase-admin');

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Firebase Init Error:", e);
  }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // Header CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (!db) throw new Error("Koneksi Database belum siap.");

    let query = db.collection('characters');

    // Default Query: Ambil karakter Default & Public
    query = query.where('visibility', 'in', ['default', 'public']);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }

    const characters = snapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        name: data.name || "Tanpa Nama",
        tagline: data.tagline || "", // Tambahan Tagline agar muncul di lobby
        description: data.description || "Tidak ada deskripsi.",
        
        image: data.image || "https://placehold.co/400x600?text=No+Image",
        backgroundImage: data.backgroundImage || "img/bg/kamar.png",
        
        sprites: data.sprites || { idle: data.image || "" },

        isVnAvailable: data.isVnAvailable === true, // Pastikan boolean
        visibility: data.visibility || 'default',

        // ▼▼▼ INI YANG KEMARIN HILANG ▼▼▼
        gameGoal: data.gameGoal || '' 
        // ▲▲▲ DATA PENTING UNTUK STORY MODE ▲▲▲
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(characters)
    };

  } catch (error) {
    console.error("Error di get-all-characters:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Gagal mengambil data.", details: error.message })
    };
  }
};