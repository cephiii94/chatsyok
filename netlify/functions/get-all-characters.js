// File: netlify/functions/get-all-characters.js

const admin = require('firebase-admin');

// Inisialisasi Firebase Admin (Gaya Stabil)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Firebase Init Error:", e);
    // Kita tidak throw error di sini agar handler di bawah bisa menangkapnya dengan rapi
  }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // Header CORS (Wajib ada)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle Preflight Request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Cek apakah db sudah siap
    if (!db) throw new Error("Koneksi Database belum siap.");

    const isGuest = event.queryStringParameters.guest === 'true';
    const isVnMode = event.queryStringParameters.mode === 'vn';

    let query = db.collection('characters');

    // --- LOGIKA FILTERING ---
    if (isVnMode) {
        // Mode VN: Hanya karakter yang support VN dan Public/Default
        query = query.where('isVnAvailable', '==', true)
                     .where('visibility', 'in', ['default', 'public']);
    } 
    else if (isGuest) {
        // Tamu: Hanya karakter Default
        query = query.where('visibility', '==', 'default');
    } 
    else {
        // User Login: Default + Public
        query = query.where('visibility', 'in', ['default', 'public']);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return {
        statusCode: 200, 
        headers,
        body: JSON.stringify([]) 
      };
    }

    // Ubah data snapshot menjadi array JSON
    const characters = snapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        name: data.name || "Tanpa Nama",
        role: data.role || "Character",
        description: data.description || "Tidak ada deskripsi.",
        
        // Image Fallback
        image: data.image || data.avatar || data.imageUrl || "https://placehold.co/400x600?text=No+Image",
        
        // Background Fallback
        backgroundImage: data.backgroundImage || data.bg || "img/bg/kamar.png",
        
        // Sprites Structure (Penting untuk VN)
        sprites: data.sprites || {
            idle: data.image || ""
        },

        isVnAvailable: data.isVnAvailable || false,
        visibility: data.visibility || 'default'
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