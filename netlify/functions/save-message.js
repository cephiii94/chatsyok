// File: netlify/functions/save-message.js

const admin = require('firebase-admin');

// Inisialisasi Firebase
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

// Helper Verifikasi Token
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Header Otorisasi tidak ditemukan.');
  }
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

exports.handler = async (event, context) => {
  // Hanya izinkan POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    // Ambil data dari body, termasuk sessionId
    const { characterId, sender, text, sessionId } = JSON.parse(event.body);

    if (!characterId || !sender || !text || !sessionId) {
      return { statusCode: 400, body: 'Data tidak lengkap (butuh sessionId).' };
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 1. Tentukan lokasi dokumen sesi
    // Path: characters > {charId} > chats > {userId} > sessions > {sessionId}
    const sessionRef = db.collection('characters').doc(characterId)
                         .collection('chats').doc(userId)
                         .collection('sessions').doc(sessionId);

    // 2. Simpan Pesan di sub-koleksi 'messages'
    await sessionRef.collection('messages').add({
      sender,
      text,
      timestamp: timestamp
    });

    // 3. Update Preview & Waktu Sesi (agar muncul paling atas di sidebar)
    // Kita potong teks jika terlalu panjang untuk preview
    let previewText = text.substring(0, 60);
    if (text.length > 60) previewText += '...';
    
    // Tambahkan prefix "Anda:" jika pengirimnya user
    const displayPreview = sender === 'user' ? `Anda: ${previewText}` : previewText;

    // Set/Merge data sesi
    await sessionRef.set({
        id: sessionId,
        preview: displayPreview,
        updatedAt: timestamp
    }, { merge: true }); 

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error("Error menyimpan pesan:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal menyimpan pesan." })
    };
  }
};