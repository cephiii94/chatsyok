// File: netlify/functions/upload-image.js (DIMODIFIKASI untuk keamanan)

const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin'); // BARU: Tambahkan firebase-admin

// Konfigurasi Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

  try {
    // BARU: Verifikasi user dulu
    // Ini memastikan hanya user login yang bisa upload
    await getUserIdFromToken(event); 
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    // 1. Ambil data gambar
    const body = JSON.parse(event.body);
    const fileData = body.file; 

    if (!fileData) {
      return { statusCode: 400, body: 'No file data provided.' };
    }

    // 2. Upload ke Cloudinary
    const result = await cloudinary.uploader.upload(fileData, {
      folder: 'chatsyok'
    });

    // 3. Kirim kembali URL
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        secure_url: result.secure_url 
      })
    };

  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Gagal meng-upload gambar." })
    };
  }
};