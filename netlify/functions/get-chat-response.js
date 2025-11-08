// File: netlify/functions/get-chat-response.js (DIMODIFIKASI untuk keamanan)

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
    // Kita tidak pakai userId-nya, tapi ini memastikan hanya user login yang bisa pakai
    await getUserIdFromToken(event); 
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    // 1. Ambil data dari frontend
    const body = JSON.parse(event.body);
    const userMessage = body.userMessage;
    const characterProfile = body.characterProfile;
    const characterName = body.characterName || 'Chatbot';
    
    if (!userMessage || !characterProfile) {
      return { statusCode: 400, body: 'Missing userMessage or characterProfile' };
    }

    // 2. Ambil Kunci API
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY tidak diatur di server.");
    }
    
    // 3. Siapkan "Resep" (Prompt)
    const prompt = `
      PERINTAH SISTEM:
      Nama Anda adalah "${characterName}".
      Anda adalah seorang chatbot. Anda HARUS mengambil peran dan kepribadian berikut:
      "${characterProfile}"

      Jaga nada bicara Anda agar selalu konsisten dengan peran tersebut. JANGAN PERNAH keluar dari karakter.
      Jangan menambahkan kata-kata seperti "(sebagai ${characterName})" di balasan Anda. Cukup *jadilah* karakter itu.

      Sekarang, balas pesan pengguna di bawah ini.
      ---
      PENGGUNA: "${userMessage}"
      ANDA (sebagai ${characterName}):
    `;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    // 4. Bangun URL API dan panggil
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error("Error dari Google API:", errorData);
      throw new Error(`Google API Error: ${errorData.error.message}`);
    }

    // 5. Ambil balasan bersih
    const responseData = await apiResponse.json();
    
    if (!responseData.candidates || !responseData.candidates[0] || !responseData.candidates[0].content || !responseData.candidates[0].content.parts[0]) {
        throw new Error("Struktur balasan API tidak valid.");
    }

    const botReply = responseData.candidates[0].content.parts[0].text;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: botReply })
    };

  } catch (error) {
    console.error("Error di get-chat-response:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Terjadi kesalahan pada server AI." })
    };
  }
};