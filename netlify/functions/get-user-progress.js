// netlify/functions/get-user-progress.js
const admin = require('firebase-admin');

// Inisialisasi Firebase Admin (Copy dari file function lain biar aman)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // 1. Cek Auth Token (Keamanan)
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    // 2. Verifikasi User
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 3. Ambil Data User dari Firestore
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      // Kalau user baru dan belum ada datanya, kembalikan kosong
      return { statusCode: 200, body: JSON.stringify({ vnProgress: {} }) };
    }

    const userData = userDoc.data();
    
    // 4. Kembalikan hanya field vnProgress
    return {
      statusCode: 200,
      body: JSON.stringify({
        vnProgress: userData.vnProgress || {} 
      })
    };

  } catch (error) {
    console.error("Error fetching progress:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};