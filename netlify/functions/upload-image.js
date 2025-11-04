// File: netlify/functions/upload-image.js

const cloudinary = require('cloudinary').v2;

// 1. Konfigurasi Cloudinary dengan kunci rahasia dari Netlify
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event, context) => {
  // Hanya izinkan metode POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Ambil data gambar (kita asumsikan dikirim sebagai string Base64)
    const body = JSON.parse(event.body);
    const fileData = body.file; // Ini adalah string 'data:image/png;base64,iVBOR...'

    if (!fileData) {
      return { statusCode: 400, body: 'No file data provided.' };
    }

    // 2. Upload ke Cloudinary
    // 'upload' akan otomatis mendeteksi tipe file dari string Base64
    const result = await cloudinary.uploader.upload(fileData, {
      folder: 'chatsyok' // (Opsional) Menyimpan semua gambar di folder 'chatsyok'
    });

    // 3. Kirim kembali URL aman dari gambar yang sudah di-upload
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