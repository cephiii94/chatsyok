const admin = require('firebase-admin');

// Inisialisasi Firebase Admin (hanya jika belum ada)
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
    // 1. Ambil semua dokumen dari koleksi 'characters'
    // 2. Urutkan berdasarkan 'document ID' (yaitu '1', '2', '3')
    const snapshot = await db.collection('characters')
                             .orderBy(admin.firestore.FieldPath.documentId())
                             .get();

    if (snapshot.empty) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Tidak ada karakter ditemukan." })
      };
    }

    // 3. Ubah data snapshot menjadi array yang rapi
    const characters = snapshot.docs.map(doc => {
      return {
        id: doc.id, // <-- Penting untuk link (cth: '1', '2')
        ...doc.data() // <-- name, description, image, etc.
      };
    });

    // 4. Kirim array karakter sebagai JSON
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