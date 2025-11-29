// File: netlify/functions/delete-history.js

const admin = require('firebase-admin');

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

async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('No Token');
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

exports.handler = async (event, context) => {
  // Hanya menerima method DELETE atau POST
  if (event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    // Ambil ID karakter dari query URL (?id=...)
    const characterId = event.queryStringParameters.id;
    
    if (!characterId) {
      return { statusCode: 400, body: 'Character ID diperlukan.' };
    }

    // Path ke koleksi pesan
    const messagesRef = db.collection('characters')
                          .doc(characterId)
                          .collection('chats')
                          .doc(userId)
                          .collection('messages');

    // 1. Ambil semua pesan
    const snapshot = await messagesRef.get();

    if (snapshot.empty) {
        return { statusCode: 200, body: JSON.stringify({ message: "Riwayat sudah kosong." }) };
    }

    // 2. Hapus satu per satu (Batch delete)
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Chat berhasil dihapus!" })
    };

  } catch (error) {
    console.error("Error deleting history:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};