// File: netlify/functions/get-history.js

const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Gagal inisialisasi Firebase:", e);
  }
}

const db = admin.firestore();

async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Header Otorisasi bermasalah.');
  }
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

exports.handler = async (event, context) => {
  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    const characterId = event.queryStringParameters.id;
    const sessionId = event.queryStringParameters.sessionId; // Parameter Wajib Baru

    if (!characterId || !sessionId) {
      // Jika tidak ada sessionId, kembalikan kosong (atau error)
      // Ini mencegah error jika frontend lupa kirim ID
      return { statusCode: 200, body: JSON.stringify([]) }; 
    }

    // Path ke pesan dalam sesi
    const snapshot = await db.collection('characters')
                             .doc(characterId)
                             .collection('chats')
                             .doc(userId)
                             .collection('sessions')
                             .doc(sessionId)
                             .collection('messages')
                             .orderBy('timestamp', 'asc')
                             .get();

    if (snapshot.empty) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      sender: doc.data().sender,
      text: doc.data().text
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(history)
    };

  } catch (error) {
    console.error("Error mengambil riwayat:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal memuat riwayat." })
    };
  }
};