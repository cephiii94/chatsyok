// File: netlify/functions/save-message.js (DIMODIFIKASI TOTAL)

const admin = require('firebase-admin');

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Gagal inisialisasi Firebase Admin:", e);
  }
}

const db = admin.firestore();

// BARU: Fungsi helper untuk verifikasi token
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Header Otorisasi tidak ditemukan atau tidak valid.');
  }
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid; // Ini adalah ID user yang AMAN
  } catch (error) {
    console.error("Verifikasi token gagal:", error);
    throw new Error('Token tidak valid atau kedaluwarsa.');
  }
}

exports.handler = async (event, context) => {
  // Hanya izinkan metode POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userId;
  try {
    // BARU: Verifikasi user dulu
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    const { characterId, sender, text } = JSON.parse(event.body);

    if (!characterId || !sender || !text) {
      return { statusCode: 400, body: 'Field (characterId, sender, text) tidak lengkap.' };
    }

    // Buat dokumen baru di sub-koleksi 'messages'
    const messageData = {
      sender: sender,
      text: text,
      timestamp: admin.firestore.FieldValue.serverTimestamp() 
    };

    // MODIFIKASI: Path database diubah total
    const docRef = db.collection('characters')
                     .doc(characterId)
                     .collection('chats') // Koleksi baru
                     .doc(userId)         // Dokumen per user
                     .collection('messages'); // Koleksi pesan user tsb
    
    await docRef.add(messageData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error("Error menyimpan pesan:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal menyimpan pesan." })
    };
  }
};