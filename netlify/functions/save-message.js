// File: netlify/functions/save-message.js

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
  // Hanya izinkan metode POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { characterId, sender, text } = JSON.parse(event.body);

    if (!characterId || !sender || !text) {
      return { statusCode: 400, body: 'Missing required fields.' };
    }

    // Buat dokumen baru di sub-koleksi 'messages'
    const messageData = {
      sender: sender,
      text: text,
      // (SANGAT PENTING) Tambahkan timestamp untuk pengurutan
      timestamp: admin.firestore.FieldValue.serverTimestamp() 
    };

    const docRef = db.collection('characters').doc(characterId).collection('messages');
    await docRef.add(messageData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error("Error saving message:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal menyimpan pesan." })
    };
  }
};