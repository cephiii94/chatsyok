// File: netlify/functions/save-mai.js (DIMODIFIKASI untuk keamanan)

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
    const data = JSON.parse(event.body);

    // Validasi data wajib (creatorId dihapus, karena kita ambil dari token)
    if (!data.name || !data.description || !data.image || !data.greeting) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Data wajib (nama, deskripsi, gambar, sapaan) tidak lengkap.' })
      };
    }

    // --- Logika untuk ID Baru ---
    const charactersRef = db.collection('characters');
    const snapshot = await charactersRef.get();
    
    let maxId = 0;
    snapshot.docs.forEach(doc => {
        const idNum = parseInt(doc.id, 10);
        if (!isNaN(idNum) && idNum > maxId) {
            maxId = idNum;
        }
    });
    
    if (maxId < 4) { // Asumsi ID 1-4 adalah default
        maxId = 4;
    }
    
    const newId = (maxId + 1).toString();

    // Siapkan data MAI untuk disimpan
    const newMaiData = {
      name: data.name,
      description: data.description, // Ini adalah prompt kepribadian
      tagline: data.tagline || '',   
      greeting: data.greeting,
      image: data.image,
      tags: data.tags || [],
      visibility: data.visibility || 'public', // Default ke 'public'
      // MODIFIKASI: Gunakan userId yang aman dari token
      creatorId: userId 
    };

    // Simpan dokumen dengan ID kustom baru
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