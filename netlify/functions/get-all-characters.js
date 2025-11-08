// File: netlify/functions/get-all-characters.js (DIMODIFIKASI)

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
    // BARU: Cek apakah ini permintaan tamu
    const isGuest = event.queryStringParameters.guest === 'true';

    let query = db.collection('characters');

    if (isGuest) {
      // MODIFIKASI: Tamu hanya lihat 'default'
      console.log("Mengambil MAI untuk Tamu (visibility: default)");
      query = query.where('visibility', '==', 'default');
    } else {
      // MODIFIKASI: User login lihat 'default' dan 'public'
      console.log("Mengambil MAI untuk User Login (visibility: default, public)");
      query = query.where('visibility', 'in', ['default', 'public']);
    }

    // Urutkan berdasarkan 'document ID' (yaitu '1', '2', '3')
    const snapshot = await query
                             .orderBy(admin.firestore.FieldPath.documentId())
                             .get();

    if (snapshot.empty) {
      console.log("Tidak ada karakter ditemukan dengan filter tersebut.");
      return {
        statusCode: 200, // Bukan error, hanya kosong
        body: JSON.stringify([]) // Kirim array kosong
      };
    }

    // Ubah data snapshot menjadi array
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Gagal mengambil data karakter." })
    };
  }
};