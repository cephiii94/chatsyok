// File: netlify/functions/delete-history.js

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

// Helper untuk menghapus koleksi (Batch Delete)
async function deleteCollection(db, collectionRef, batchSize) {
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'DELETE') {
      return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let userId;
  try {
    userId = await getUserIdFromToken(event);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
  }

  const charId = event.queryStringParameters.id;
  const sessionId = event.queryStringParameters.sessionId; // Parameter Baru

  if (!charId) {
      return { statusCode: 400, body: "Character ID diperlukan." };
  }

  try {
    // Path dasar user chat
    const chatsRef = db.collection('characters').doc(charId).collection('chats').doc(userId);

    if (sessionId) {
        // --- MODE 1: Hapus SATU Sesi ---
        const sessionDoc = chatsRef.collection('sessions').doc(sessionId);
        const messagesRef = sessionDoc.collection('messages');

        // 1. Hapus semua pesan di dalam sesi
        await deleteCollection(db, messagesRef, 50);
        
        // 2. Hapus dokumen sesi itu sendiri
        await sessionDoc.delete();

        return { statusCode: 200, body: JSON.stringify({ success: true, message: "Sesi berhasil dihapus." }) };

    } else {
        // --- MODE 2: Hapus SEMUA (Legacy/Clear All) ---
        // Hapus koleksi sesi satu per satu (karena Firestore butuh rekursif untuk sub-koleksi)
        const sessionsSnapshot = await chatsRef.collection('sessions').get();
        
        const deletePromises = sessionsSnapshot.docs.map(async (doc) => {
            await deleteCollection(db, doc.ref.collection('messages'), 50);
            return doc.ref.delete();
        });

        await Promise.all(deletePromises);

        return { statusCode: 200, body: JSON.stringify({ success: true, message: "Semua riwayat dihapus." }) };
    }

  } catch (error) {
    console.error("Delete Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};