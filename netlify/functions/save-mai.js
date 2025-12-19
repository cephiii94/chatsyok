// File: netlify/functions/save-mai.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) { console.error("Firebase Init Error:", e); }
}
const db = admin.firestore();

// Helper Auth
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

    // Validasi Field Utama
    if (!data.name || !data.description) {
      return { statusCode: 400, body: JSON.stringify({ error: "Nama & Deskripsi wajib diisi." }) };
    }

    // Siapkan Dokumen Baru
    const newDocRef = db.collection('characters').doc();
    
    const newChar = {
      id: newDocRef.id, // ID otomatis dari Firebase
      creatorId: userId,
      
      name: data.name,
      greeting: data.greeting,
      tagline: data.tagline,
      description: data.description,
      tags: data.tags || [],
      visibility: data.visibility || 'public',
      
      // Data Visual
      image: data.image || null,
      sprites: data.sprites || {}, // { happy: url, sad: url ... }

      // Data Game / Story
      mode: data.mode || 'free', // 'free' atau 'story'
      isVnAvailable: data.isVnAvailable || false,
      gameGoal: data.gameGoal || "",
      
      // [BARU] Field Chapter Manager
      chapters: data.chapters || [], 

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Simpan ke Firestore
    await newDocRef.set(newChar);

    return { statusCode: 200, body: JSON.stringify({ success: true, id: newDocRef.id }) };

  } catch (error) {
    console.error("Save Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};