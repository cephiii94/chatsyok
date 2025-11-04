// File: netlify/functions/get-chat-response.js

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ambil API Key dari environment variables Netlify
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.handler = async (event, context) => {
  
  // Hanya izinkan metode POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Ambil data (pesan & profil) dari frontend
    const body = JSON.parse(event.body);
    const userMessage = body.userMessage;
    const characterProfile = body.characterProfile; // Ini adalah 'description' dari Firebase

    if (!userMessage || !characterProfile) {
      return { statusCode: 400, body: 'Missing userMessage or characterProfile' };
    }

    // 2. INI ADALAH LOGIKA ANDA: Buat prompt "Peran"
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
      PERINTAH SISTEM:
      Anda adalah seorang chatbot. Anda HARUS mengambil peran dan kepribadian berikut:
      "${characterProfile}"

      Jaga nada bicara Anda agar selalu konsisten dengan peran tersebut. JANGAN PERNAH keluar dari karakter.
      Jangan menambahkan kata-kata seperti "(sebagai burung hantu)" di balasan Anda. Cukup *jadilah* karakter itu.

      Sekarang, balas pesan pengguna di bawah ini.
      ---
      PENGGUNA: "${userMessage}"
      ANDA (sebagai ${characterProfile.split(' ')[0]}):
    `;

    // 3. Panggil Gemini dengan prompt yang sudah "dibungkus"
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const botReply = response.text();

    // 4. Kirim balasan bersih dari AI kembali ke frontend
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: botReply })
    };

  } catch (error) {
    console.error("Error di get-chat-response:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Terjadi kesalahan pada server AI." })
    };
  }
};