// File: netlify/functions/save-mai.js
// VERSI: FIXED (Menyimpan Story Chapters & Mode)

const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) { console.error("Firebase Init Error:", e); }
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
    const data = JSON.parse(event.body);

    if (!data.name || !data.description || !data.image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Data wajib tidak lengkap.' }) };
    }

    // Auto-ID Sederhana
    const charactersRef = db.collection('characters');
    const snapshot = await charactersRef.get();
    let maxId = 0;
    snapshot.docs.forEach(doc => {
        const idNum = parseInt(doc.id, 10);
        if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
    });
    if (maxId < 4) maxId = 4;
    const newId = (maxId + 1).toString();

    // [BRI FIXED] Pastikan field storyChapters & mode masuk ke sini!
    const newMaiData = {
      name: data.name,
      description: data.description, 
      tagline: data.tagline || '',   
      greeting: data.greeting,
      image: data.image,
      tags: data.tags || [],
      visibility: data.visibility || 'public',
      creatorId: userId,
      
      // --- DATA VISUAL NOVEL ---
      isVnAvailable: data.isVnAvailable === true,
      mode: data.mode || 'free',              // PENTING: simpan mode (story/free)
      gameGoal: data.gameGoal || '',          // PENTING: simpan goal
      storyChapters: data.storyChapters || [], // PENTING: simpan array chapter
      sprites: data.sprites || {},            // PENTING: simpan sprite
      // -------------------------

      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await charactersRef.doc(newId).set(newMaiData);

    return { statusCode: 200, body: JSON.stringify({ success: true, id: newId }) };

  } catch (error) {
    console.error("Save Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};