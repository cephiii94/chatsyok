// File: netlify/functions/update-mai.js

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

    if (!data.id) return { statusCode: 400, body: JSON.stringify({ error: "Character ID Missing" }) };

    // 1. Cek Kepemilikan (Opsional: Pastikan yg edit adalah creator)
    const charRef = db.collection('characters').doc(data.id);
    const doc = await charRef.get();
    
    if (!doc.exists) return { statusCode: 404, body: JSON.stringify({ error: "Character not found" }) };
    
    // Jika mau strict owner check, uncomment baris bawah:
    // if (doc.data().creatorId !== userId) return { statusCode: 403, body: "Unauthorized" };

    // 2. Siapkan Data Update
    const updatePayload = {
        name: data.name,
        description: data.description,
        tagline: data.tagline,
        greeting: data.greeting,
        image: data.image,
        tags: data.tags,
        visibility: data.visibility,
        
        // Data VN / Story Mode
        mode: data.mode,
        isVnAvailable: data.isVnAvailable,
        gameGoal: data.gameGoal,
        storyChapters: data.storyChapters, // Array story baru
        sprites: data.sprites,

        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 3. Update Firestore
    await charRef.update(updatePayload);

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error("Update Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};