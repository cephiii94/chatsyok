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

// --- HELPER BARU: Ambil Data Token Lengkap ---
// Kita butuh ini untuk melihat apakah ada stempel "admin: true"
async function getAuthTokenData(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Header Otorisasi tidak ditemukan.');
  }
  const token = authHeader.split('Bearer ')[1];
  // verifyIdToken mengembalikan objek yang berisi uid DAN custom claims (admin)
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken; 
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userToken;
  try {
    // Ambil data user beserta status admin-nya
    userToken = await getAuthTokenData(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  const userId = userToken.uid;
  const isAdmin = userToken.admin === true; // Cek status admin

  try {
    const data = JSON.parse(event.body);
const { id, name, description, tagline, greeting, image, tags, visibility, isVnAvailable } = data;
    if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'ID Karakter diperlukan.' }) };
    }

    const docRef = db.collection('characters').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Karakter tidak ditemukan.' }) };
    }

    const currentData = docSnap.data();

    // --- LOGIKA PENJAGA PINTU UTAMA ---
    // Boleh lewat jika: Dia Pembuatnya ATAU Dia Admin
    const isCreator = currentData.creatorId === userId;

    if (!isCreator && !isAdmin) {
        return { 
            statusCode: 403, 
            body: JSON.stringify({ error: 'Eits! Anda bukan pemilik MAI ini dan bukan Admin.' }) 
        };
    }

    // Siapkan data update
    const updateData = {
        name,
        description,
        tagline: tagline || '',
        greeting,
        tags: tags || [],
        visibility: visibility || 'public',
        isVnAvailable: isVnAvailable === true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (image) {
        updateData.image = image;
    }

    await docRef.update(updateData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'MAI berhasil diupdate oleh ' + (isAdmin ? 'Admin' : 'Creator') })
    };

  } catch (error) {
    console.error("Error updating MAI:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal mengupdate MAI." })
    };
  }
};