// File: netlify/functions/get-chat-response-vn.js
// VERSI: DYNAMIC DB STORY (Membaca Skenario dari Database)

const admin = require('firebase-admin');

// --- 1. SETUP FIREBASE ---
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) { console.error("Firebase Init Error:", e); }
}
const db = admin.firestore();

// --- 2. HELPER FUNCTIONS ---
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('No Token');
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

async function urlToGenerativePart(fileUrl) {
    try {
        const response = await fetch(fileUrl, { headers: { 'User-Agent': 'Bot/1.0' } });
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        return {
            inlineData: {
                data: Buffer.from(buffer).toString('base64'),
                mimeType: response.headers.get('content-type') || 'image/jpeg'
            }
        };
    } catch (e) { return null; }
}

// ==========================================
// 🏛️ KAMAR A: STORY MODE HANDLER (DATABASE VERSION)
// ==========================================
async function handleStoryMode(params) {
    const { db, userId, sessionId, characterId, userMessage, userName } = params;

    // 1. AMBIL DATA KARAKTER & CERITA DARI DB
    const charDoc = await db.collection('characters').doc(characterId).get();
    if (!charDoc.exists) throw new Error("Karakter tidak ditemukan.");
    
    const charData = charDoc.data();
    
    // Ambil array story dari database.
    const STORY_LINE = charData.storyChapters || []; 
    
    // Fallback jika cerita belum ditulis
    if (STORY_LINE.length === 0) {
        return { 
            reply: JSON.stringify({ 
                message: "[SAD] (Maaf, Author belum menulis skenario untuk karakter ini...)", 
                choices: [], 
                gameStatus: "finished" 
            }), 
            mode: 'story' 
        };
    }

    // 2. Tentukan Chapter (Logic: Hitung jumlah chat / 4)
    // (Nanti bisa Tuan upgrade pakai field 'currentChapter' di database session)
    const historySnapshot = await db.collection('characters').doc(characterId)
        .collection('chats').doc(userId).collection('sessions').doc(sessionId)
        .collection('messages').orderBy('timestamp', 'asc').get();

    const totalTurns = historySnapshot.size;
    const turnsPerChapter = 5; // Ganti chapter setiap 5 balon chat
    
    let currentChapterIndex = Math.floor(totalTurns / turnsPerChapter);
    
    // Cegah index melebihi jumlah chapter
    if (currentChapterIndex >= STORY_LINE.length) {
        currentChapterIndex = STORY_LINE.length - 1; 
    }

    const currentScene = STORY_LINE[currentChapterIndex];
    const isEnding = (currentChapterIndex === STORY_LINE.length - 1);

    // 3. Siapkan History Text
    let historyText = "";
    historySnapshot.docs.forEach(doc => {
        const d = doc.data();
        let txt = d.text;
        // Parse JSON history jika ada, ambil messagenya saja
        try { if (d.sender !== 'user' && txt.trim().startsWith('{')) txt = JSON.parse(txt).message; } catch(e){}
        historyText += `${d.sender}: ${txt}\n`;
    });

// 4. Prompt Engineering (VN Style - Lebih Hidup & Dramatis)
    const systemInstruction = `
    Kamu adalah Karakter Visual Novel bernama "${charData.name}".
    
    [STATUS CERITA SAAT INI]
    BABAK: ${currentScene.title || 'Unknown'}
    SITUASI: ${currentScene.context || '-'}
    TUJUAN KAMU: ${currentScene.goal || '-'}
    SYARAT LANJUT: ${currentScene.endCondition || '-'}
    
    [GAYA BICARA & VISUAL NOVEL STYLE]
    1. Panjang jawaban singkat namun jelas sesuai konteks. 
    2. Sertakan AKSI VISUAL di dalam tanda bintang *...*. 
       Contoh: *menghela nafas panjang sambil melihat hujan* atau *tersenyum malu-malu*.
    3. Gunakan Bahasa Indonesia yang luwes, tidak kaku, bisa sedikit gaul/formal sesuai peran.
    4. Fokus pada EMOSI. Buat User merasakan suasana (immersive).

    [ATURAN TEKNIS]
    Output WAJIB format JSON tunggal. Jangan ada teks lain di luar JSON.

    JSON FORMAT:
    {
      "message": "Dialog kamu (bisa gabungan *aksi* dan teks)",
      "choices": [
        { "text": "Respon User A", "type": "neutral" },
        { "text": "Respon User B", "type": "neutral" }
      ],
      "gameStatus": "${isEnding ? 'finished' : 'ongoing'}"
    }
    
    EMOTION LIST (Pilih satu untuk sprite): [IDLE], [HAPPY], [SAD], [ANGRY], [SHY], [SURPRISED], [THINKING]
    `;

    const fullPrompt = `
    ${systemInstruction}
    HISTORY:\n${historyText}
    USER INPUT: "${userMessage}"
    RESPONSE (JSON):
    `;

    // 5. Call Gemma API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
    };

    const apiRes = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await apiRes.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Bersihkan Markdown JSON
    reply = reply.replace(/```json/gi, '').replace(/```/g, '').trim();

    try { 
        const parsed = JSON.parse(reply);
        if (isEnding) parsed.gameStatus = 'finished';
        reply = JSON.stringify(parsed);
    } catch (e) {
        reply = JSON.stringify({ 
            message: "[IDLE] (AI Error: JSON Invalid)", 
            choices: [{text: "Lanjut", type: "neutral"}], 
            gameStatus: "ongoing" 
        });
    }

    return { reply, mode: 'story' };
}

// ==========================================
// 🎡 KAMAR B: FREE MODE HANDLER
// ==========================================
async function handleFreeMode(params) {
    const { db, characterId, sessionId, userId, userMessage, characterName, characterProfile, userName, userLocalTime } = params;

    // 1. Handle Image
    const isFile = userMessage.startsWith('http');
    let filePart = null;
    let finalUserMsg = userMessage;
    if (isFile) {
        filePart = await urlToGenerativePart(userMessage);
        finalUserMsg = filePart ? "[SYSTEM: User kirim gambar]" : "[SYSTEM: File error]";
    }

    // 2. Get History
    const historySnapshot = await db.collection('characters').doc(characterId)
        .collection('chats').doc(userId).collection('sessions').doc(sessionId)
        .collection('messages').orderBy('timestamp', 'desc').limit(10).get();

    let historyContext = "";
    historySnapshot.docs.reverse().forEach(doc => {
        const d = doc.data();
        if (d.text === userMessage && d.sender === 'user') return; 
        let txt = d.text;
        try { if (txt.startsWith('{')) txt = JSON.parse(txt).message; } catch(e){}
        historyContext += `${d.sender === 'user' ? 'User' : characterName}: "${txt}"\n`;
    });

    // 3. Prompt Free Mode
    const systemInstruction = `
    Role: "${characterName}". Profile: "${characterProfile}".
    User: "${userName}". Waktu: ${userLocalTime || 'Sekarang'}.
    
    ATURAN:
    1. Bahasa Indonesia Gaul/Natural.
    2. Pendek (2-3 kalimat).
    3. WAJIB awali dengan TAG EMOSI: [IDLE], [HAPPY], [SAD], [ANGRY], [SURPRISED], [SHY], [THINKING].
    
    History:
    ${historyContext}
    
    Pesan Baru: "${finalUserMsg}"
    Respon:
    `;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
        contents: [{ parts: [{ text: systemInstruction }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 500 }
    };
    if (filePart) payload.contents[0].parts.unshift(filePart);

    const apiRes = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await apiRes.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "[IDLE] ...";

    if (!reply.startsWith('[')) reply = `[IDLE] ${reply}`;

    return { reply, mode: 'free' };
}

// ==========================================
// 🛎️ MAIN HANDLER (RESEPSIONIS)
// ==========================================
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const userId = await getUserIdFromToken(event);
    const body = JSON.parse(event.body);
    
    // Bungkus semua data
    const params = { db, userId, ...body };

    console.log(`[REQUEST] Mode: ${body.mode}, Character: ${body.characterName}`);

    // --- SWITCHING LOGIC ---
    if (body.mode === 'story') {
        const result = await handleStoryMode(params);
        return { statusCode: 200, body: JSON.stringify(result) };
    } else {
        const result = await handleFreeMode(params);
        return { statusCode: 200, body: JSON.stringify(result) };
    }

  } catch (error) {
    console.error("Handler Error:", error);
    const isStory = (event.body && JSON.parse(event.body).mode === 'story');
    const msg = `[SAD] (Maaf, sistem error: ${error.message})`;
    
    const safeReply = isStory 
        ? JSON.stringify({ message: msg, choices: [{text:"Retry",type:"neutral"}], gameStatus: "ongoing" })
        : msg;

    return { statusCode: 200, body: JSON.stringify({ reply: safeReply, mode: isStory ? 'story' : 'free' }) };
  }
};