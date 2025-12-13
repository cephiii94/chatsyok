// File: netlify/functions/get-all-characters.js

const admin = require('firebase-admin');

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
  try {
    // Pastikan env variable FIREBASE_SERVICE_ACCOUNT ada
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT tidak ditemukan.");
    }
  } catch (e) {
    console.error("Gagal inisialisasi Firebase Admin:", e);
  }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // Header CORS (Penting agar frontend bisa akses)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const isGuest = event.queryStringParameters.guest === 'true';
    const isVnMode = event.queryStringParameters.mode === 'vn';

    let query = db.collection('characters');

    // --- LOGIKA FILTERING ---
    if (isVnMode) {
        query = query.where('isVnAvailable', '==', true)
                     .where('visibility', 'in', ['default', 'public']);
    } 
    else if (isGuest) {
        query = query.where('visibility', '==', 'default');
    } 
    else {
        query = query.where('visibility', 'in', ['default', 'public']);
    }

    const snapshot = await query.get(); // Hapus orderBy sementara jika belum ada index

    if (snapshot.empty) {
      return {
        statusCode: 200, 
        headers,
        body: JSON.stringify([]) 
      };
    }

    // Ubah data snapshot menjadi array JSON yang SINKRON dengan chat.js
    const characters = snapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        name: data.name || "Tanpa Nama",
        role: data.role || "Character",
        description: data.description || "Tidak ada deskripsi.",
        
        // MAPPING PENTING UNTUK VISUAL (Menangani berbagai kemungkinan nama field di DB)
        // Chat.js butuh 'image' atau 'sprites.idle'
        image: data.image || data.avatar || data.imageUrl || "https://placehold.co/400x600?text=No+Image",
        
        // Chat.js butuh 'backgroundImage'
        backgroundImage: data.backgroundImage || data.bg || data.background || "img/bg/kamar.png",
        
        // Chat.js butuh struktur 'sprites'
        sprites: data.sprites || {
            idle: data.image || data.avatar || ""
        },

        // Properti lain diteruskan
        isVnAvailable: data.isVnAvailable,
        visibility: data.visibility
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
      body: JSON.stringify({ 
        error: "Gagal mengambil data karakter.", 
        details: error.message 
      })
    };
  }
};