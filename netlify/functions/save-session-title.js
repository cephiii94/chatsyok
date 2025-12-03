// File: netlify/functions/save-session-title.js

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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const userId = await getUserIdFromToken(event);
    const { characterId, sessionId, title } = JSON.parse(event.body);

    if (!characterId || !sessionId || !title) {
        return { statusCode: 400, body: "Data tidak lengkap." };
    }

    const sessionRef = db.collection('characters').doc(characterId)
                         .collection('chats').doc(userId)
                         .collection('sessions').doc(sessionId);

    // Update session: Set judul, tandai sebagai saved
    await sessionRef.set({
        title: title,
        isSaved: true, // Flag penting untuk filtering
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};