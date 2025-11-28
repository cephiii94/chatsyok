// File: netlify/functions/get-chat-response.js (UPDATE: DENGAN USER PERSONA)

const admin = require('firebase-admin');

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
    const { userMessage, characterProfile, characterId, userPersona } = body; // <--- ADA userPersona
    const characterName = body.characterName || 'Chatbot';
    
    if (!userMessage || !characterProfile || !characterId) {
      return { statusCode: 400, body: 'Data tidak lengkap.' };
    }

    // Ambil Riwayat Chat
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
        historyContext = "RIWAYAT OBROLAN SEBELUMNYA:\n";
        historyDocs.forEach(doc => {
            const data = doc.data();
            const role = data.sender === 'user' ? 'PENGGUNA' : `ANDA (${characterName})`;
            const cleanText = (data.text || "").replace(/\n/g, " ");
            historyContext += `${role}: "${cleanText}"\n`;
        });
        historyContext += "\n--- BATAS RIWAYAT ---\n";
    }

    // PROMPT SYSTEM YANG BARU
    const userRoleText = userPersona 
        ? `PENGGUNA YANG ANDA AJAK BICARA MEMILIKI PERAN/BIO:\n"${userPersona}"\n(Sesuaikan respon Anda dengan fakta ini!)` 
        : "Pengguna adalah orang asing/umum.";

    const finalPrompt = `
      PERINTAH SISTEM:
      Nama Anda: "${characterName}"
      Kepribadian Anda: "${characterProfile}"

      ${userRoleText}

      ATURAN:
      1. Tetaplah dalam karakter "${characterName}".
      2. Responlah sesuai dengan kepribadian Anda DAN siapa lawan bicara Anda (lihat info pengguna di atas).
      3. Gunakan konteks riwayat di bawah ini.

      ${historyContext}

      PESAN BARU:
      PENGGUNA: "${userMessage}"
      
      JAWABAN ANDA:
    `;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
    });

    if (!apiResponse.ok) {
        const err = await apiResponse.json();
        throw new Error(err.error.message);
    }

    const responseData = await apiResponse.json();
    const botReply = responseData.candidates[0].content.parts[0].text;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: botReply })
    };

  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};