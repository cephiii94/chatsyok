// File: netlify/functions/get-chat-response.js
// Versi ini menggunakan 'fetch' (REST API)

exports.handler = async (event, context) => {
  // Hanya izinkan metode POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Ambil data dari frontend
    const body = JSON.parse(event.body);
    const userMessage = body.userMessage;
    const characterProfile = body.characterProfile;

    if (!userMessage || !characterProfile) {
      return { statusCode: 400, body: 'Missing userMessage or characterProfile' };
    }

    // 2. Ambil Kunci API dari environment
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY tidak diatur di server.");
    }
    
    // 3. Siapkan "Resep" (Struktur JSON) untuk Gemini REST API
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

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    // 4. Bangun URL API dan panggil menggunakan 'fetch'
    // ▼▼▼ PERBAIKAN DI SINI ▼▼▼
    // Mengganti model ke 'gemini-2.5-flash-preview-09-2025'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
      // Jika Gemini error (misal: 400, 500)
      const errorData = await apiResponse.json();
      console.error("Error dari Google API:", errorData);
      throw new Error(`Google API Error: ${errorData.error.message}`);
    }

    // 5. Ambil balasan bersih dari AI
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