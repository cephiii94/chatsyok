// File: netlify/functions/upload-image.js

const cloudinary = require('cloudinary').v2;
const admin = require('firebase-admin');

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Init Firebase (Untuk Cek Token)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) { console.error(e); }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // 1. Cek Token User
    const authHeader = event.headers.authorization;
    if (!authHeader) throw new Error('Unauthorized');
    const token = authHeader.split('Bearer ')[1];
    await admin.auth().verifyIdToken(token);

    // 2. Parse Body
    const body = JSON.parse(event.body);
    
    // Validasi Input
    if (!body.file) {
        return { statusCode: 400, body: JSON.stringify({ error: "Data file tidak ditemukan." }) };
    }

    // 3. Upload ke Cloudinary
    // Cloudinary pintar, dia bisa baca base64 langsung
    const result = await cloudinary.uploader.upload(body.file, {
        folder: "mai_chat_uploads",
        resource_type: "auto"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ secure_url: result.secure_url })
    };

  } catch (error) {
    console.error("Upload Failed:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};