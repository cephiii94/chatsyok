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
    console.error("Gagal inisialisasi Firebase Admin:", e);
  }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  try {
    const isGuest = event.queryStringParameters.guest === 'true';
    // Ambil parameter mode (jika ada)
    const isVnMode = event.queryStringParameters.mode === 'vn';

    let query = db.collection('characters');

    // --- LOGIKA FILTERING ---
    if (isVnMode) {
        // Mode VN: Cari yang isVnAvailable = true DAN visibilitasnya Publik/Default
        console.log("Mengambil MAI untuk Mode Visual Novel");
        query = query.where('isVnAvailable', '==', true)
                     .where('visibility', 'in', ['default', 'public']);
    } 
    else if (isGuest) {
        // Tamu: Hanya lihat 'default'
        console.log("Mengambil MAI untuk Tamu (visibility: default)");
        query = query.where('visibility', '==', 'default');
    } 
    else {
        // User Login: Lihat 'default' dan 'public'
        console.log("Mengambil MAI untuk User Login (visibility: default, public)");
        query = query.where('visibility', 'in', ['default', 'public']);
    }

    // Urutkan berdasarkan ID dokumen
    const snapshot = await query
                             .orderBy(admin.firestore.FieldPath.documentId())
                             .get();

    if (snapshot.empty) {
      // Kembalikan array kosong jika tidak ada data
      return {
        statusCode: 200, 
        body: JSON.stringify([]) 
      };
    }

    // Ubah data snapshot menjadi array JSON
    const characters = snapshot.docs.map(doc => {
      return {
        id: doc.id, 
        ...doc.data()
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(characters)
    };

  } catch (error) {
    console.error("Error di get-all-characters:", error);
    
    // Penanganan error khusus jika index Firestore belum dibuat
    if (error.code === 9 || error.message.includes('The query requires an index')) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "Firestore Index Missing. Cek log Netlify untuk link pembuatan index.",
                details: error.message
            })
        };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Gagal mengambil data karakter." })
    };
  }
};