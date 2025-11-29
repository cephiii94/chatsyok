// File: netlify/functions/delete-mai.js

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

async function getAuthTokenData(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No Token');
  }
  const token = authHeader.split('Bearer ')[1];
  return await admin.auth().verifyIdToken(token);
}

exports.handler = async (event, context) => {
  // Hanya izinkan DELETE
  if (event.httpMethod !== 'DELETE') {
      return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userToken;
  try {
    userToken = await getAuthTokenData(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  const userId = userToken.uid;
  const isAdmin = userToken.admin === true;
  const charId = event.queryStringParameters.id;

  if (!charId) {
      return { statusCode: 400, body: "ID Karakter diperlukan." };
  }

  try {
    const docRef = db.collection('characters').doc(charId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return { statusCode: 404, body: "Karakter tidak ditemukan." };
    }

    const data = doc.data();

    // CEK IZIN: Hanya Creator atau Admin yang boleh menghapus
    if (data.creatorId !== userId && !isAdmin) {
        return { 
            statusCode: 403, 
            body: JSON.stringify({ error: "Anda tidak berhak menghapus MAI ini." }) 
        };
    }

    // Lakukan Penghapusan
    await docRef.delete();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "MAI berhasil dihapus." })
    };

  } catch (error) {
    console.error("Delete Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};