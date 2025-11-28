// File: netlify/functions/update-mai.js

const admin = require('firebase-admin');

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

// Helper Verifikasi Token
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Header Otorisasi tidak ditemukan.');
  }
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { id, name, description, tagline, greeting, image, tags, visibility } = data;

    if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'ID Karakter diperlukan.' }) };
    }

    const docRef = db.collection('characters').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Karakter tidak ditemukan.' }) };
    }

    const currentData = docSnap.data();

    // KEAMANAN: Pastikan yang mengedit adalah PEMBUAT (creatorId)
    // Kecuali jika user adalah Admin (opsional, tapi kita fokus ke owner dulu)
    if (currentData.creatorId !== userId) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Anda tidak memiliki izin mengedit MAI ini.' }) };
    }

    // Siapkan data update
    const updateData = {
        name,
        description,
        tagline: tagline || '',
        greeting,
        tags: tags || [],
        visibility: visibility || 'public',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Hanya update gambar jika ada gambar baru (tidak null/undefined)
    if (image) {
        updateData.image = image;
    }

    await docRef.update(updateData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'MAI berhasil diupdate' })
    };

  } catch (error) {
    console.error("Error updating MAI:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal mengupdate MAI." })
    };
  }
};