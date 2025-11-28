// File: netlify/functions/manage-persona.js

const admin = require('firebase-admin');

// Inisialisasi Firebase (Cek agar tidak double init)
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
  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  // Ambil charId dari Query (GET) atau Body (POST)
  let charId;
  if (event.httpMethod === 'GET') {
      charId = event.queryStringParameters.charId;
  } else if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      charId = body.charId;
  }

  if (!charId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Character ID diperlukan.' }) };
  }

  // Lokasi penyimpanan: characters/{charId}/chats/{userId}
  // Kita simpan di dokumen parent dari sub-koleksi 'messages'
  const chatDocRef = db.collection('characters').doc(charId).collection('chats').doc(userId);

  try {
    if (event.httpMethod === 'GET') {
        const doc = await chatDocRef.get();
        const persona = (doc.exists && doc.data().userPersona) ? doc.data().userPersona : '';
        return {
            statusCode: 200,
            body: JSON.stringify({ persona })
        };
    } 
    else if (event.httpMethod === 'POST') {
        const { persona } = JSON.parse(event.body);
        // Set merge: true agar tidak menimpa field lain jika ada
        await chatDocRef.set({ userPersona: persona }, { merge: true });
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } 
    else {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
  } catch (error) {
    console.error("Error managing persona:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};