// File: netlify/functions/get-chat-response.js

const admin = require('firebase-admin');

// Inisialisasi Firebase
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("Firebase Init Error:", e);
  }
}

const db = admin.firestore();

// Helper Auth
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('No Token');
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { userMessage, characterProfile, characterId, userPersona } = body;
    const characterName = body.characterName || 'Chatbot';
    
    if (!userMessage || !characterProfile || !characterId) {
      return { statusCode: 400, body: 'Data tidak lengkap.' };
    }

    // 1. Ambil Riwayat Chat
    const historySnapshot = await db.collection('characters')
                                    .doc(characterId)
                                    .collection('chats')
                                    .doc(userId)
                                    .collection('messages')
                                    .orderBy('timestamp', 'desc')
                                    .limit(10)
                                    .get();

    const historyDocs = historySnapshot.docs.reverse();
    let historyContext = "";
    if (!historyDocs.empty) {
        historyContext = "KONTEKS OBROLAN TERDAHULU:\n";
        historyDocs.forEach(doc => {
            const data = doc.data();
            const role = data.sender === 'user' ? 'User' : characterName;
            const cleanText = (data.text || "").replace(/\n/g, " ");
            historyContext += `${role}: "${cleanText}"\n`;
        });
        historyContext += "\n--- BATAS KONTEKS ---\n";
    }

    // 2. Prompt Hybrid
    const userRoleText = userPersona 
        ? `User memiliki peran: "${userPersona}".` 
        : "User adalah teman ngobrol.";

    const finalPrompt = `
      PERINTAH: Berperanlah sebagai karakter berikut.
      Nama: "${characterName}"
      Deskripsi: "${characterProfile}"
      ${userRoleText}

      ATURAN PENTING (WAJIB DIPATUHI):
      1. GAYA BICARA: Santai tapi sopan, natural, seperti chat di WhatsApp. Jangan kaku/baku.
      2. PANJANG: Jawab SINGKAT (maksimal 2-4 kalimat). 
      3. SINGKATAN: Boleh pakai singkatan umum (yg, gak, udh, bgt) biar terasa manusiawi.
      4. Jangan mengulang kata-kata User. Langsung respon intinya saja.
      5. Tetap pada karakter (Roleplay), jangan keluar dari peran. tapi tidak memaksa jika topik di luar karakter.
      6. Jika tidak tahu jawaban, katakan dengan jujur bahwa kamu tidak tahu.
      7. Jangan pernah menyebutkan bahwa kamu adalah AI atau chatbot.
      8. Jaga kesopanan kalimat dan hindari topik sensitif.

      ${historyContext}

      PESAN BARU USER: "${userMessage}"
      
      RESPON ${characterName}:
    `;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          contents: [{ parts: [{ text: finalPrompt }] }],
          // Safety Settings agar tidak sensitif
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
          // ▼▼▼ PERBAIKAN UTAMA DI SINI ▼▼▼
          generationConfig: {
              temperature: 0.85, 
              maxOutputTokens: 2000, // Kita beri ruang 2000 token (biar dia puas mikir dulu)
          }
      })
    });

    if (!apiResponse.ok) {
        const err = await apiResponse.json();
        console.error("Gemini API Error:", JSON.stringify(err, null, 2));
        throw new Error(err.error.message);
    }

    const responseData = await apiResponse.json();

    // 3. Parsing Aman
    const candidateText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

    let botReply = "";
    
    if (candidateText) {
        botReply = candidateText.trim();
    } else {
        console.error("AI Menolak Menjawab/Kosong. Full Response:", JSON.stringify(responseData, null, 2));
        botReply = "..."; 
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: botReply })
    };

  } catch (error) {
    console.error("Handler Error:", error);
    return { 
        statusCode: 200, 
        body: JSON.stringify({ reply: "(Maaf, ada gangguan koneksi ke otak AI)" }) 
    };
  }
};