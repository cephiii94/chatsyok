// File: netlify/functions/get-chat-response.js
// VERSI FINAL + FIX SESSION: Support Waktu, Lokasi, File, dan Sesi Terisolasi

const admin = require('firebase-admin');

// 1. Inisialisasi Firebase Admin
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

// 2. Helper Auth (Verifikasi Token)
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No Token Provided');
  }
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

// 3. Helper Download File (Gambar/PDF) dengan Retry & User-Agent
async function urlToGenerativePart(fileUrl) {
    console.log("Downloading file:", fileUrl);
    
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
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
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error(`Gagal download setelah ${maxRetries}x percobaan. Error: ${lastError.message}`);
}

// 4. Handler Utama
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  try {
    const body = JSON.parse(event.body);
    
    // --- UPDATE 1: AMBIL SESSION ID ---
    const { 
        userMessage, 
        characterProfile, 
        characterId, 
        userPersona, 
        userName, 
        userLocalTime,
        sessionId // <--- Ini penting!
    } = body;

    const characterName = body.characterName || 'Chatbot';
    
    if (!userMessage || !characterProfile || !characterId || !sessionId) {
      return { statusCode: 400, body: 'Data wajib (termasuk Session ID) tidak lengkap.' };
    }

    // --- A. LOGIKA WAKTU & LOKASI ---
    
    let timeString;
    if (userLocalTime) {
        timeString = userLocalTime;
    } else {
        const now = new Date();
        timeString = now.toLocaleString('id-ID', { 
            timeZone: 'Asia/Jakarta', 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });
    }

    const userCity = event.headers['x-nf-client-connection-ip-city'];
    const userCountry = event.headers['x-nf-client-connection-ip-country'];
    const userLocation = userCity ? `${userCity}, ${userCountry}` : 'Indonesia';

    // --- B. PROSES FILE ---
    const isFile = userMessage.startsWith('https://res.cloudinary.com');
    let filePart = null;
    let textMessageForPrompt = userMessage;

    if (isFile) {
        console.log("📂 Memproses lampiran file...");
        try {
            filePart = await urlToGenerativePart(userMessage);
            
            if (filePart.inlineData.mimeType === 'application/pdf') {
                textMessageForPrompt = "[SYSTEM: Pengguna melampirkan dokumen PDF. Baca dan analisis isinya.]";
            } else {
                textMessageForPrompt = "[SYSTEM: Pengguna melampirkan sebuah GAMBAR. Lihat dan komentari visualnya.]";
            }
        } catch (imgErr) {
            console.error("Gagal proses file:", imgErr);
            textMessageForPrompt = `[SYSTEM ERROR: Gagal mengunduh lampiran. Pesan error: ${imgErr.message}]`;
        }
    }

    // --- C. RIWAYAT CHAT (DIPERBAIKI) ---
    // Update 2: Query Firestore masuk ke 'sessions -> sessionId'
    const historySnapshot = await db.collection('characters')
                                    .doc(characterId)
                                    .collection('chats')
                                    .doc(userId)
                                    .collection('sessions') // Masuk ke koleksi sessions
                                    .doc(sessionId)         // Masuk ke ID sesi spesifik
                                    .collection('messages')
                                    .orderBy('timestamp', 'desc') // Ambil yg terbaru dulu
                                    .limit(10) // Ambil 10 terakhir
                                    .get();

    const historyDocs = historySnapshot.docs.reverse(); // Balik jadi (Lama -> Baru)
    let historyContext = "";
    
    if (!historyDocs.empty) {
        historyContext = "RIWAYAT OBROLAN (Sesi Ini):\n";
        historyDocs.forEach(doc => {
            const data = doc.data();
            
            // CEGAH DOUBLE INPUT:
            // Karena 'saveMessage' dipanggil sebelum API ini, pesan terakhir di DB adalah pesan user saat ini.
            // Kita skip pesan terakhir dari riwayat agar tidak dobel dengan "PESAN BARU" di prompt.
            if (data.text === userMessage && data.sender === 'user') {
                return; // Skip, karena ini akan masuk lewat variabel 'PESAN BARU'
            }

            const role = data.sender === 'user' ? 'User' : characterName;
            let cleanText = (data.text || "").replace(/\n/g, " ");
            if (cleanText.startsWith('https://res.cloudinary.com')) {
                cleanText = "[Lampiran File]";
            }
            historyContext += `${role}: "${cleanText}"\n`;
        });
        historyContext += "--- BATAS RIWAYAT ---\n";
    }

    // --- D. SUSUN PROMPT ---
    const userRoleText = userPersona ? `Peran User: "${userPersona}".` : "Peran User: Teman bicara.";

    const finalPrompt = `
      PERINTAH SISTEM:
      Berperanlah sebagai karakter imajiner berikut. Jangan break character.

      PROFIL KARAKTER:
      - Nama: "${characterName}"
      - Deskripsi: "${characterProfile}"
      
      DATA REAL-TIME:
      - Waktu User: ${timeString}
      - Lokasi User: ${userLocation}
      - Nama User: "${userName || 'Teman'}"
      - ${userRoleText}

      ATURAN MAIN:
      1. Jawab santai, natural, seperti chat WhatsApp. 
      2. Jawab SINGKAT (2-3 kalimat), kecuali menjelaskan isi PDF/Gambar.
      3. JANGAN menyapa detail waktu/hari/tanggal kecuali ditanya.
      4. Jangan mengulang kata-kata User.
      5. Jangan berjanji melakukan aksi fisik.
      6. Jika ditanya "Jam berapa?", lihat data "Waktu User".
      7. Tetap pada karakter (Roleplay).
      8. Jangan menyebut kamu AI.
      9. HINDARI PENGULANGAN: Jika di riwayat kamu sudah menyapa, jangan menyapa lagi. Langsung ke topik.
      10. tidak usah sebut nama jika persona tidak menyebutkan nama user.

      KONTEKS RIWAYAT:
      ${historyContext}

      PESAN BARU: "${textMessageForPrompt}"
      
      RESPON ${characterName}:
    `;

    // --- E. REQUEST KE GEMINI ---
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    // Gunakan model Flash terbaru atau Pro sesuai selera Tuan
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{ parts: [] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 2000,
        }
    };

    if (filePart) payload.contents[0].parts.push(filePart);
    payload.contents[0].parts.push({ text: finalPrompt });

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
        const err = await apiResponse.json();
        throw new Error(`Gemini Error: ${err.error?.message || 'Unknown error'}`);
    }

    const responseData = await apiResponse.json();
    const candidateText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

    let botReply = candidateText ? candidateText.trim() : "Maaf, saya tidak bisa merespon pesan ini (mungkin terfilter).";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: botReply })
    };

  } catch (error) {
    console.error("Handler Error:", error);
    return { 
        statusCode: 200, 
        body: JSON.stringify({ reply: `(Sistem Error: ${error.message})` }) 
    };
  }
};