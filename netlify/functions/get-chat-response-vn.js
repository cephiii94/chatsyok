// File: netlify/functions/get-chat-response-vn.js
// VERSI: GEMINI 2.5 FLASH (THE LATEST & GREATEST)
// Menggunakan model 'gemini-2.5-flash' sesuai akses Tuan.

const admin = require('firebase-admin');

// 1. Inisialisasi Firebase
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

// 2. Helper Auth
async function getUserIdFromToken(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No Token Provided');
  }
  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken.uid;
}

// 3. Helper Download File
async function urlToGenerativePart(fileUrl) {
    console.log("Downloading file:", fileUrl);
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const buffer = await response.arrayBuffer();
        return {
            inlineData: {
                data: Buffer.from(buffer).toString('base64'),
                mimeType: response.headers.get('content-type') || 'image/jpeg'
            }
        };
    } catch (error) {
        console.error("File download error:", error);
        return null;
    }
}

// 4. Handler Utama
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const userId = await getUserIdFromToken(event);
    const body = JSON.parse(event.body);
    
    // Ambil data dari body
    const { 
        userMessage, characterProfile, characterId, 
        userPersona, userName, userLocalTime, sessionId,
        mode = 'free', gameGoal = '' 
    } = body;
    
    const characterName = body.characterName || 'Chatbot';

    // --- SETUP LOGIKA MODE ---
    // Mode Story aktif jika: mode='story' DAN ada gameGoal
    const isStoryMode = (mode === 'story' && gameGoal && gameGoal.trim().length > 0);
    
    let systemInstruction = "";
    
    if (isStoryMode) {
        // === PROMPT KHUSUS STORY MODE (GAME) ===
        systemInstruction = `
        ROLE: You are "${characterName}" and a Game Master for a Visual Novel.
        GAME GOAL: "${gameGoal}"

        TASK:
        1. Reply to the user as the character (Immerse in role).
        2. Advance the plot based on the GAME GOAL.
        3. Provide 3 distinct choices for the user.
        
        OUTPUT FORMAT (STRICT JSON ONLY, NO MARKDOWN):
        {
          "message": "[EMOTION] Your character dialogue here...",
          "choices": [
            { "text": "Choice A (Positive/Helpful)", "type": "good" },
            { "text": "Choice B (Neutral)", "type": "neutral" },
            { "text": "Choice C (Negative/Risky)", "type": "bad" }
          ],
          "gameStatus": "ongoing"
        }
        
        EMOTIONS: [IDLE], [HAPPY], [SAD], [ANGRY], [SHY], [SURPRISED].
        IMPORTANT: Do not wrap the output in \`\`\`json blocks. Just raw JSON.
        `;
    } else {
        // === PROMPT FREE MODE (CHAT BIASA) ===
        systemInstruction = `
        ROLE: You are "${characterName}".
        PROFILE: "${characterProfile}"
        TASK: Chat naturally with the user. Keep it concise.
        FORMAT: Start with [EMOTION]. Example: "[HAPPY] Hello there!"
        EMOTIONS: [IDLE], [HAPPY], [SAD], [ANGRY], [SHY], [SURPRISED].
        `;
    }

    // --- KONTEKS RIWAYAT ---
    // Ambil 6 pesan terakhir agar AI ingat konteks
    const historySnapshot = await db.collection('characters').doc(characterId)
        .collection('chats').doc(userId).collection('sessions').doc(sessionId)
        .collection('messages').orderBy('timestamp', 'desc').limit(6).get();
    
    let historyText = "";
    const historyDocs = historySnapshot.docs.reverse(); // Urutkan dari lama ke baru
    
    historyDocs.forEach(doc => {
        const d = doc.data();
        if(d.text !== userMessage) { // Skip pesan yang baru dikirim user sekarang
             let txt = d.text;
             // Jika pesan sebelumnya adalah JSON (dari bot story mode), ambil message-nya saja
             try { 
                 if (d.sender !== 'user' && txt.trim().startsWith('{')) {
                    txt = JSON.parse(txt).message;
                 }
             } catch(e){} 
             historyText += `${d.sender}: ${txt}\n`;
        }
    });

    const fullPrompt = `
    ${systemInstruction}
    
    CONTEXT INFO:
    User: ${userName} (${userPersona || 'Player'})
    Time: ${userLocalTime || 'Unknown'}
    
    CHAT HISTORY:
    ${historyText}
    
    LATEST USER INPUT: "${userMessage}"
    
    YOUR RESPONSE:
    `;

    // --- REQUEST KE GEMINI 2.5 FLASH ---
    // [UPDATE PENTING]: Menggunakan model yang Tuan miliki
    const modelName = "gemini-2.5-flash"; 
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const payload = {
        contents: [{ parts: [] }],
        generationConfig: { 
            temperature: 0.8,
            maxOutputTokens: 1000
        }
    };

    // Tambahkan File jika ada
    if (userMessage.startsWith('http')) {
        const fileData = await urlToGenerativePart(userMessage);
        if(fileData) {
            payload.contents[0].parts.push(fileData);
            payload.contents[0].parts.push({ text: fullPrompt + "\n(User sent an image/file above)" });
        } else {
            payload.contents[0].parts.push({ text: fullPrompt });
        }
    } else {
        payload.contents[0].parts.push({ text: fullPrompt });
    }

    // Hit API
    const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!apiRes.ok) {
        const err = await apiRes.json();
        console.error("Gemini 2.5 Error:", JSON.stringify(err));
        throw new Error(`Gemini 2.5 Error: ${err.error?.message || apiRes.statusText}`);
    }

    const data = await apiRes.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "[SAD] (No response)";

    // --- CLEANING / PARSING JSON ---
    if (isStoryMode) {
        // Hapus markdown block ```json jika AI bandel menambahkannya
        reply = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try { 
            // Cek apakah valid JSON
            JSON.parse(reply); 
        } catch (e) { 
            console.error("JSON Parse Error:", reply);
            // Fallback UI jika JSON rusak
            reply = JSON.stringify({
                message: "[SHY] (Maaf, aku sedikit bingung... Boleh ulangi?)",
                choices: [
                    { text: "Lanjut cerita", type: "neutral" },
                    { text: "Ulangi pertanyaan", type: "neutral" }
                ],
                gameStatus: "ongoing"
            });
        }
    }

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply, mode: isStoryMode ? 'story' : 'free' })
    };

  } catch (error) {
    console.error("Function Error:", error);
    // Return format JSON valid meski error agar frontend tidak crash
    const errorJson = JSON.stringify({
        message: `[SYSTEM] Error: ${error.message}`,
        choices: [],
        gameStatus: "ongoing"
    });
    
    return {
        statusCode: 200,
        body: JSON.stringify({ 
            reply: errorJson, 
            isError: true 
        })
    };
  }
};