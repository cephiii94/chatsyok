// File: netlify/functions/get-chat-response.js (MODEL 2.5 + ROBUST FIXES)

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

// --- FUNGSI DOWNLOAD KUAT (User-Agent + Retry) ---
async function urlToGenerativePart(fileUrl) {
    console.log("Downloading file:", fileUrl);
    
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            // Header User-Agent & Connection Close (PENTING!)
            const response = await fetch(fileUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Connection': 'close' 
                }
            });

            if (!response.ok) throw new Error(`Status: ${response.status} ${response.statusText}`);
            
            const buffer = await response.arrayBuffer();
            const base64Data = Buffer.from(buffer).toString('base64');
            const mimeType = response.headers.get('content-type') || 'image/jpeg';

            return {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            };

        } catch (err) {
            console.warn(`Percobaan download ke-${i + 1} gagal: ${err.message}`);
            lastError = err;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Tunggu 1 detik
        }
    }
    throw new Error(`Gagal download setelah ${maxRetries}x percobaan. Error: ${lastError.message}`);
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

    // 1. Deteksi File (Gambar/PDF)
    const isFile = userMessage.startsWith('https://res.cloudinary.com');
    let filePart = null;
    let textMessageForPrompt = userMessage;

    if (isFile) {
        console.log("📂 Memproses file Cloudinary...");
        try {
            filePart = await urlToGenerativePart(userMessage);
            
            if (filePart.inlineData.mimeType === 'application/pdf') {
                textMessageForPrompt = "[Pengguna melampirkan dokumen PDF. Baca dan analisis isinya.]";
            } else {
                textMessageForPrompt = "[Pengguna melampirkan sebuah GAMBAR. Lihat dan komentari visualnya.]";
            }
        } catch (imgErr) {
            console.error("Gagal proses file:", imgErr);
            textMessageForPrompt = `[SYSTEM ERROR: Gagal mengunduh lampiran. Pesan error: ${imgErr.message}]`;
        }
    }

    // 2. Ambil Riwayat Chat
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
            let cleanText = (data.text || "").replace(/\n/g, " ");
            if (cleanText.startsWith('https://res.cloudinary.com')) {
                cleanText = "[Lampiran File]";
            }
            historyContext += `${role}: "${cleanText}"\n`;
        });
        historyContext += "\n--- BATAS KONTEKS ---\n";
    }

    // 3. Prompt Hybrid
    const userRoleText = userPersona 
        ? `User memiliki peran: "${userPersona}".` 
        : "User adalah teman ngobrol.";

    const finalPrompt = `
      PERINTAH: Berperanlah sebagai karakter berikut.
      Nama: "${characterName}"
      Deskripsi: "${characterProfile}"
      ${userRoleText}

      ATURAN PENTING (WAJIB DIPATUHI):
      1. GAYA BICARA: Santai, natural, seperti chat di WhatsApp. Jangan kaku/baku.
      2. PANJANG: Jawab SINGKAT (maksimal 2-3 kalimat), KECUALI sedang menjelaskan isi dokumen PDF.
      3. SINGKATAN: Boleh pakai singkatan umum (yg, gak, udh, bgt).
      4. Jangan mengulang kata-kata User. Langsung respon intinya saja.
      5. Tetap pada karakter (Roleplay).
      6. JIKA ADA LAMPIRAN (GAMBAR/PDF): Analisis isinya dengan detail.

      ${historyContext}

      PESAN BARU USER: "${textMessageForPrompt}"
      
      RESPON ${characterName}:
    `;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    // ▼▼▼ KEMBALI KE MODEL 2.5 YANG LEBIH PINTAR ▼▼▼
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

    // 4. Susun Payload
    const parts = [];
    if (filePart) parts.push(filePart);
    parts.push({ text: finalPrompt });

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          contents: [{ parts: parts }], 
          // Safety Settings (PENTING: BLOCK_NONE agar tidak rewel)
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
          // Config Token Besar (PENTING untuk Model 2.5 biar bisa mikir)
          generationConfig: {
              temperature: 0.85, 
              maxOutputTokens: 2000, // 2000 Token = Aman untuk thinking process
          }
      })
    });

    if (!apiResponse.ok) {
        const err = await apiResponse.json();
        console.error("Gemini API Error:", JSON.stringify(err, null, 2));
        throw new Error(err.error.message);
    }

    const responseData = await apiResponse.json();

    // 5. Parsing Anti-Crash (PENTING)
    const candidateText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

    let botReply = "";
    if (candidateText) {
        botReply = candidateText.trim();
    } else {
        console.error("AI Menolak Menjawab (Prohibited/Error):", JSON.stringify(responseData, null, 2));
        // Pesan sopan jika AI menolak gambar tertentu
        botReply = "Maaf, sistem keamananku memblokir gambar ini (mungkin dianggap sensitif oleh Google). Coba gambar lain ya!"; 
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ reply: botReply })
    };

  } catch (error) {
    console.error("Handler Error:", error);
    return { 
        statusCode: 200, 
        body: JSON.stringify({ reply: `(Maaf, ada gangguan sistem: ${error.message})` }) 
    };
  }
};