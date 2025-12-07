// File: netlify/functions/save-mai.js

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

// Fungsi helper untuk verifikasi token
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Header Otorisasi tidak ditemukan atau tidak valid.');
  }
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid; 
  } catch (error) {
    console.error("Verifikasi token gagal:", error);
    throw new Error('Token tidak valid atau kedaluwarsa.');
  }
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

    // Validasi data wajib
    if (!data.name || !data.description || !data.image || !data.greeting) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Data wajib (nama, deskripsi, gambar, sapaan) tidak lengkap.' })
      };
    }

    // --- Logika untuk ID Baru ---
    // (Mencari ID terbesar untuk auto-increment sederhana)
    const charactersRef = db.collection('characters');
    const snapshot = await charactersRef.get();
    
    let maxId = 0;
    snapshot.docs.forEach(doc => {
        const idNum = parseInt(doc.id, 10);
        if (!isNaN(idNum) && idNum > maxId) {
            maxId = idNum;
        }
    });
    
    if (maxId < 4) { 
        maxId = 4;
    }
    
    const newId = (maxId + 1).toString();

    // Siapkan data MAI untuk disimpan
    const newMaiData = {
      name: data.name,
      description: data.description, 
      tagline: data.tagline || '',   
      greeting: data.greeting,
      image: data.image,
      tags: data.tags || [],
      visibility: data.visibility || 'public',
      creatorId: userId,
      
      // ▼▼▼ TAMBAHAN: Simpan status VN ▼▼▼
      // Pastikan disimpan sebagai boolean
      isVnAvailable: data.isVnAvailable === true,
      // ▲▲▲ AKHIR TAMBAHAN ▲▲▲
      
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Simpan dokumen
    await charactersRef.doc(newId).set(newMaiData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: newId })
    };

  } catch (error) {
    console.error("Error saving new MAI:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Gagal menyimpan MAI baru ke database." })
    };
  }
};