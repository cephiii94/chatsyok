// File: netlify/functions/get-sessions.js

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
  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    const charId = event.queryStringParameters.charId;
    if (!charId) return { statusCode: 400, body: "Butuh charId" };

    // MODIFIKASI: Hapus .orderBy dari query Firestore untuk menghindari error Index
    const sessionsRef = db.collection('characters').doc(charId)
                          .collection('chats').doc(userId)
                          .collection('sessions')
                          .where('isSaved', '==', true);

    const snapshot = await sessionsRef.get();
    
    let sessions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            preview: data.title || data.preview || '(Tanpa Judul)',
            // Pastikan format waktu aman
            updatedAt: data.updatedAt ? data.updatedAt.toMillis() : 0 
        };
    });

    // SORTING MANUAL DI JAVASCRIPT (Terbaru di atas)
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    return { statusCode: 200, body: JSON.stringify(sessions) };
  } catch (e) {
    console.error("Error get-sessions:", e); // Log error ke Netlify
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};