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

async function getAuthTokenData(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Header Otorisasi tidak ditemukan.');
  }
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken; 
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userToken;
  try {
    userToken = await getAuthTokenData(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  const userId = userToken.uid;
  const isAdmin = userToken.admin === true; 

  try {
    const data = JSON.parse(event.body);
    // Tambahkan 'sprites' di sini
    const { id, name, description, tagline, greeting, image, sprites, tags, visibility, isVnAvailable } = data;

    if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'ID Karakter diperlukan.' }) };
    }

    const docRef = db.collection('characters').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Karakter tidak ditemukan.' }) };
    }

    const currentData = docSnap.data();

    // Verifikasi Pemilik
    const isCreator = currentData.creatorId === userId;
    if (!isCreator && !isAdmin) {
        return { 
            statusCode: 403, 
            body: JSON.stringify({ error: 'Anda bukan pemilik MAI ini.' }) 
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
    
    // UPDATE PENTING: Simpan sprites jika ada
    if (sprites) {
        updateData.sprites = sprites;
    }

    await docRef.update(updateData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error("Error updating MAI:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal mengupdate MAI." })
    };
  }
};