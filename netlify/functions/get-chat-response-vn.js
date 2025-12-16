// File: netlify/functions/get-chat-response-vn.js
// VERSI: FULL GEMMA 3 (Revisi Prompt: Strict Emotion Tags)

const admin = require('firebase-admin');

// 1. SETUP FIREBASE
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) { console.error("Firebase Init Error:", e); }
}
const db = admin.firestore();

async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('No Token');
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

// Helper Download
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

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const userId = await getUserIdFromToken(event);
    const body = JSON.parse(event.body);
    
    const { 
        userMessage, characterProfile, characterId, 
        userPersona, userName, sessionId, userLocalTime,
        mode = 'free', gameGoal 
    } = body;
    
    const characterName = body.characterName || 'Character';

    // ========================================================================
    // 🎭 JALUR 1: STORY MODE (PAKAI GEMMA 3)
    // ========================================================================
    if (mode === 'story') {
        
        const effectiveGoal = (gameGoal && gameGoal.trim().length > 0) 
            ? gameGoal 
            : "Buat percakapan menarik dan biarkan pemain memilih takdirnya.";

        // Prompt Story Mode: Dipertajam di bagian JSON Structure
        const systemInstruction = `
        Kamu adalah MAI, karakter visual novel yang hidup. Nama: "${characterName}".
        GOAL: "${effectiveGoal}"
        
        INSTRUCTION:
        1. GAYA BICARA: Santai tapi sopan, natural, seperti chat di WhatsApp. Jangan kaku/baku.
        2. PANJANG: Jawab SINGKAT (maksimal 2-4 kalimat). 
        3. SINGKATAN: Boleh pakai singkatan umum (yg, gak, udh, bgt) biar terasa manusiawi.
        4. Jangan mengulang kata-kata User. Langsung respon intinya saja.
        5. Tetap pada karakter (Roleplay), jangan keluar dari peran.
        6. You MUST output a SINGLE JSON OBJECT. Do not write any text outside the JSON.

        EMOTION LIST (WAJIB PILIH SATU):
        [IDLE], [HAPPY], [SAD], [ANGRY], [SHY], [SURPRISED], [THINKING]
        
        JSON STRUCTURE (STRICT):
        {
          "message": "String (WAJIB dimulai dengan [TAG_EMOSI]. Contoh: '[HAPPY] Halo kak! Apa kabar?')",
          "choices": [
            { "text": "Pilihan A (Good)", "type": "good" },
            { "text": "Pilihan B (Neutral)", "type": "neutral" },
            { "text": "Pilihan C (Bad)", "type": "bad" }
          ],
          "gameStatus": "ongoing"
        }
        `;

        const historySnapshot = await db.collection('characters').doc(characterId)
            .collection('chats').doc(userId).collection('sessions').doc(sessionId)
            .collection('messages').orderBy('timestamp', 'desc').limit(6).get();
        
        let historyText = "";
        historySnapshot.docs.reverse().forEach(doc => {
            const d = doc.data();
            let txt = d.text;
            // Parse JSON history jika ada, ambil messagenya saja
            try { if (d.sender !== 'user' && txt.trim().startsWith('{')) txt = JSON.parse(txt).message; } catch(e){}
            historyText += `${d.sender}: ${txt}\n`;
        });

        const fullPrompt = `
        ${systemInstruction}
        CONTEXT: User: ${userName}. History:\n${historyText}
        INPUT: "${userMessage}"
        RESPONSE (JSON):
        `;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const payload = {
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { 
                temperature: 0.7, 
                maxOutputTokens: 1000 
            }
        };

        const apiRes = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(!apiRes.ok) throw new Error(await apiRes.text());
        const data = await apiRes.json();
        let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        reply = reply.replace(/```json/gi, '').replace(/```/g, '').trim();

        try { JSON.parse(reply); } 
        catch (e) { 
            console.warn("Gemma output not valid JSON:", reply);
            reply = JSON.stringify({ 
                message: reply || "[SHY] (Maaf, aku melamun...)", 
                choices: [{text:"Lanjut",type:"neutral"}] 
            }); 
        }

        return { statusCode: 200, body: JSON.stringify({ reply, mode: 'story' }) };
    }

    // ========================================================================
    // ☕ JALUR 2: FREE MODE (GEMMA 3) - REVISI BESAR DI SINI
    // ========================================================================
    else {
        let timeString = userLocalTime || new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const isFile = userMessage.startsWith('http');
        let filePart = null;
        let finalUserMsg = userMessage;
        if (isFile) {
            filePart = await urlToGenerativePart(userMessage);
            finalUserMsg = filePart ? "[SYSTEM: User kirim gambar]" : "[SYSTEM: File error]";
        }

        const historySnapshot = await db.collection('characters').doc(characterId)
            .collection('chats').doc(userId).collection('sessions').doc(sessionId)
            .collection('messages').orderBy('timestamp', 'desc').limit(10).get();

        let historyContext = "";
        historySnapshot.docs.reverse().forEach(doc => {
            const d = doc.data();
            if (d.text === userMessage && d.sender === 'user') return; 
            let txt = d.text;
            // Clean up JSON format if any, but KEEP THE EMOTION TAG inside string if possible
            try { 
                if (txt.startsWith('{')) {
                    const parsed = JSON.parse(txt);
                    txt = parsed.message; // Ambil teks yg masih ada [HAPPY]-nya
                }
            } catch(e){}
            
            historyContext += `${d.sender === 'user' ? 'User' : characterName}: "${txt}"\n`;
        });

        // PROMPT FREE MODE YANG SUDAH DIPERKUAT
        const systemInstruction = `
        Role: "${characterName}". Profile: "${characterProfile}".
        Context: Waktu: ${timeString}. User: "${userName}".
        
        ATURAN UTAMA:
        1. Gunakan BAHASA INDONESIA (Gaul/Sehari-hari).
        2. Jawab singkat & natural (max 2-3 kalimat).
        
        ATURAN EMOSI (WAJIB & STRICT):
        Setiap kalimat balasanmu HARUS diawali dengan salah satu TAG EMOSI berikut:
        - [IDLE] (Biasa)
        - [HAPPY] (Senang/Tertawa)
        - [SAD] (Sedih/Kecewa)
        - [ANGRY] (Marah/Kesal)
        - [SURPRISED] (Kaget)
        - [SHY] (Malu)
        - [THINKING] (Bingung)

        JANGAN PERNAH MENJAWAB TANPA TAG INI.
        
        CONTOH YANG BENAR:
        User: Halo Mai!
        Mai: [HAPPY] Halo juga! Senang ketemu kamu.
        
        User: Aku sedih nih.
        Mai: [SAD] Yah, kenapa? Sini cerita sama aku.
        
        User: Hantu!!
        Mai: [SURPRISED] Hah?! Mana?! Aku takut!

        History Percakapan:
        ${historyContext}
        
        Pesan Baru: "${finalUserMsg}"
        Respon Kamu (Ingat Tag Emosi):
        `;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: systemInstruction }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: 500 }
        };
        
        if (filePart) payload.contents[0].parts.unshift(filePart);

        const apiRes = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await apiRes.json();
        let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "...";

        // Fallback: Jika AI bandel ga kasih tag, kita paksa kasih [IDLE] biar frontend ga bingung
        if (!reply.startsWith('[')) {
            reply = `[IDLE] ${reply}`;
        }

        return { statusCode: 200, body: JSON.stringify({ reply, mode: 'free' }) };
    }

  } catch (error) {
    console.error("Handler Error:", error);
    const isStoryRequest = (event.body && JSON.parse(event.body).mode === 'story');
    
    // Pesan Error yang ramah
    const msg = error.message.includes("429") 
        ? "[SAD] (Aduh, aku pusing... istirahat sebentar ya.)" 
        : `[SAD] (Server Error: ${error.message})`;

    const safeReply = isStoryRequest 
        ? JSON.stringify({ message: msg, choices: [{text:"Coba Lagi",type:"neutral"}] })
        : msg;

    return { statusCode: 200, body: JSON.stringify({ reply: safeReply, mode: isStoryRequest ? 'story' : 'free' }) };
  }
};