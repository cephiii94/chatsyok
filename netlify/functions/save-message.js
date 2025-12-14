// File: netlify/functions/save-message.js

const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
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

// --- DAFTAR MISI LENCANA ---
const BADGE_DEFINITIONS = [
    { id: 'chat_1', threshold: 1, type: 'totalChats', name: 'Langkah Pertama', icon: '👶' },
    { id: 'chat_10', threshold: 10, type: 'totalChats', name: 'Warga Baru', icon: '👋' },
    { id: 'chat_50', threshold: 50, type: 'totalChats', name: 'Bawel', icon: '🗣️' },
    { id: 'chat_100', threshold: 100, type: 'totalChats', name: 'Sepuh Chat', icon: '💬' },
    { id: 'chat_1000', threshold: 1000, type: 'totalChats', name: 'Dewa Koding', icon: '👑' }
];

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const userId = await getUserIdFromToken(event);
    const { characterId, sender, text, sessionId } = JSON.parse(event.body);

    if (!characterId || !sender || !text || !sessionId) {
      return { statusCode: 400, body: 'Data tidak lengkap.' };
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    // 1. Simpan Pesan
    const sessionRef = db.collection('characters').doc(characterId)
                         .collection('chats').doc(userId)
                         .collection('sessions').doc(sessionId);
    const messageRef = sessionRef.collection('messages').doc();

    batch.set(messageRef, { sender, text, timestamp });

    // 2. Update Preview
    let previewText = text.substring(0, 60) + (text.length > 60 ? '...' : '');
    const displayPreview = sender === 'user' ? `Anda: ${previewText}` : previewText;
    batch.set(sessionRef, { id: sessionId, preview: displayPreview, updatedAt: timestamp, isSaved: true }, { merge: true });

    // --- 3. LOGIKA GAMIFIKASI (XP & BADGES) ---
    let xpAdded = 0;
    let isLevelUp = false;
    let newLevelNumber = 1;
    let unlockedBadges = []; // Daftar lencana baru yang didapat kali ini

    if (sender === 'user') {
        xpAdded = 10;
        const userRef = db.collection('users').doc(userId);
        
        // Baca data user terbaru
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        
        // Hitung Stats Baru
        const currentXp = userData.xp || 0;
        const currentTotalChats = (userData.stats?.totalChats || 0) + 1; // +1 chat sekarang
        const currentBadges = userData.badges || []; // Array ID badge yang sudah dimiliki

        // -- Cek Level Up --
        const newXp = currentXp + xpAdded;
        const oldLevel = Math.floor(currentXp / 100) + 1;
        const currentLevel = Math.floor(newXp / 100) + 1;
        if (currentLevel > oldLevel) {
            isLevelUp = true;
            newLevelNumber = currentLevel;
        }

        // -- Cek Badge Unlocked --
        // Loop semua kemungkinan badge
        BADGE_DEFINITIONS.forEach(badge => {
            // Jika belum punya badge ini
            if (!currentBadges.includes(badge.id)) {
                // Cek syarat (misal totalChats >= threshold)
                if (badge.type === 'totalChats' && currentTotalChats >= badge.threshold) {
                    unlockedBadges.push(badge); // Hore! Dapat badge baru
                }
            }
        });

        // Gabungkan badge lama dengan badge baru
        const newBadgeIds = unlockedBadges.map(b => b.id);
        const finalBadges = [...currentBadges, ...newBadgeIds];

        // Simpan Update User
        batch.set(userRef, {
            xp: newXp,
            stats: {
                totalChats: admin.firestore.FieldValue.increment(1) // Increment atomik
            },
            badges: finalBadges, // Simpan array badge
            lastActive: timestamp
        }, { merge: true });
    }

    await batch.commit();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
          success: true,
          xpAdded: xpAdded,
          levelUp: isLevelUp,
          newLevel: newLevelNumber,
          newBadges: unlockedBadges // Kirim info badge baru ke frontend
      })
    };

  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Gagal menyimpan." }) };
  }
};