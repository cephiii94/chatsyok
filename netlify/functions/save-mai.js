// File: netlify/functions/save-mai.js
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

    if (!data.name || !data.description) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Data wajib tidak lengkap.' }) };
    }

    // Generate ID Baru (Auto-ID dari Firestore lebih aman)
    const newDocRef = db.collection('characters').doc(); 
    const newId = newDocRef.id;

    const newMaiData = {
      id: newId, 
      name: data.name,
      description: data.description, 
      tagline: data.tagline || '',   
      greeting: data.greeting,
      image: data.image || null,
      tags: data.tags || [],
      visibility: data.visibility || 'public',
      creatorId: userId,
      
      // --- DATA GAME / STORY ---
      mode: data.mode || 'free',
      isVnAvailable: data.isVnAvailable === true,
      gameGoal: data.gameGoal || '',
      
      // [FIX] Kita simpan sebagai 'chapters' (SAMA DENGAN EDIT & LOBBY)
      chapters: data.chapters || [], 
      
      sprites: data.sprites || {},

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await newDocRef.set(newMaiData);

    return { statusCode: 200, body: JSON.stringify({ success: true, id: newId }) };

  } catch (error) {
    console.error("Save Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};