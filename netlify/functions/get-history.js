// File: netlify/functions/get-history.js (DIMODIFIKASI TOTAL)

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

// BARU: Fungsi helper untuk verifikasi token
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Header Otorisasi tidak ditemukan atau tidak valid.');
  }
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid; // Ini adalah ID user yang AMAN
  } catch (error) {
    console.error("Verifikasi token gagal:", error);
    throw new Error('Token tidak valid atau kedaluwarsa.');
  }
}

exports.handler = async (event, context) => {
  let userId;
  try {
    // BARU: Verifikasi user dulu
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    const characterId = event.queryStringParameters.id;
    if (!characterId) {
      return { statusCode: 400, body: 'Character ID tidak ditemukan.' };
    }

    // MODIFIKASI: Path database diubah total
    const snapshot = await db.collection('characters')
                             .doc(characterId)
                             .collection('chats') // Koleksi baru
                             .doc(userId)         // Dokumen per user
                             .collection('messages') // Koleksi pesan user tsb
                             .orderBy('timestamp', 'asc')
                             .get();

    if (snapshot.empty) {
      return {
        statusCode: 200,
        body: JSON.stringify([]) // Kirim array kosong jika tidak ada riwayat
      };
    }

    // Ubah data snapshot menjadi array
    const history = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        sender: data.sender,
        text: data.text
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(history)
    };

  } catch (error) {
    console.error("Error mengambil riwayat:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal memuat riwayat obrolan." })
    };
  }
};