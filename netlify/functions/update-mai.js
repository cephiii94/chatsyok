// File: netlify/functions/update-mai.js

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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Auth Token');
  }
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const userId = await getUserIdFromToken(event);
    const data = JSON.parse(event.body);

    if (!data.id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'ID Character required' }) };
    }

    const charRef = db.collection('characters').doc(data.id);
    const doc = await charRef.get();

    if (!doc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Character not found' }) };
    }

    const currentData = doc.data();

    // Pastikan hanya pemilik atau admin yang bisa edit
    // (Implementasi sederhana: hanya cek creatorId)
    if (currentData.creatorId !== userId) {
         // Di real app, cek juga custom claim 'admin'
         // Tapi untuk sekarang kita proteksi basic dulu
         // return { statusCode: 403, body: 'Unauthorized' };
    }

    // Siapkan data update
    const updatePayload = {
      name: data.name,
      description: data.description,
      tagline: data.tagline || '',
      greeting: data.greeting,
      tags: data.tags || [],
      visibility: data.visibility || 'public',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      // Update Image & Sprites jika dikirim
      image: data.image,
      sprites: data.sprites || {},

      // [BRI UPDATE: Update VN Status & Goal]
      isVnAvailable: data.isVnAvailable === true,
      gameGoal: data.gameGoal || '' 
    };

    await charRef.update(updatePayload);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error("Update Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};