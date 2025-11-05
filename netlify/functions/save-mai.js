// File: netlify/functions/save-mai.js

const admin = require('firebase-admin');

// Inisialisasi Firebase Admin (jika belum ada)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Gagal inisialisasi Firebase Admin:", e);
    // Jika gagal di sini, fungsi tidak akan bisa berjalan
  }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // Hanya izinkan metode POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    // Validasi data wajib
    if (!data.name || !data.description || !data.image || !data.greeting || !data.creatorId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Data wajib (nama, deskripsi, gambar, sapaan, creatorId) tidak lengkap.' })
      };
    }

    // --- Logika untuk ID Baru ---
    // Kita akan mencari ID numerik tertinggi dan menambahkannya
    const charactersRef = db.collection('characters');
    const snapshot = await charactersRef.get();
    
    let maxId = 0;
    snapshot.docs.forEach(doc => {
        const idNum = parseInt(doc.id, 10);
        if (!isNaN(idNum) && idNum > maxId) {
            maxId = idNum;
        }
    });
    
    // ID baru adalah maxId + 1, diubah kembali ke string
    // Kita mulai dari 5, karena Anda bilang 4 MAI pertama adalah default
    if (maxId < 4) {
        maxId = 4; // Memastikan ID buatan user mulai dari 5
    }
    
    const newId = (maxId + 1).toString();

    // Siapkan data MAI untuk disimpan
    const newMaiData = {
      name: data.name,
      description: data.description, // Ini adalah prompt kepribadian
      tagline: data.tagline || '',   // Deskripsi singkat untuk lobi
      greeting: data.greeting,
      image: data.image,
      tags: data.tags || [],
      visibility: data.visibility || 'public',
      creatorId: data.creatorId // Simpan ID pembuat
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