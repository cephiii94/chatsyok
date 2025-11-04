// File: netlify/functions/get-history.js

const admin = require('firebase-admin');

// Inisialisasi Firebase Admin (jika belum ada)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  try {
    const characterId = event.queryStringParameters.id;

    if (!characterId) {
      return { statusCode: 400, body: 'Missing character ID.' };
    }

    // Ambil semua pesan, urutkan berdasarkan timestamp (paling lama ke paling baru)
    const snapshot = await db.collection('characters')
                             .doc(characterId)
                             .collection('messages')
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
        // Kita tidak perlu kirim timestamp ke frontend
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(history)
    };

  } catch (error) {
    console.error("Error getting history:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal memuat riwayat obrolan." })
    };
  }
};