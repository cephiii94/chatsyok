// File: netlify/functions/delete-mai.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) { console.error("Firebase Init Error:", e); }
}
const db = admin.firestore();

exports.handler = async (event, context) => {
  // Hanya izinkan method DELETE atau POST
  if (event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Cek Token Auth (Keamanan)
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // 2. Ambil ID dari Body
    const data = JSON.parse(event.body);
    const charId = data.id;

    if (!charId) {
      return { statusCode: 400, body: JSON.stringify({ error: "ID Karakter diperlukan" }) };
    }

    // 3. Cek Kepemilikan (Opsional tapi disarankan)
    const charRef = db.collection('characters').doc(charId);
    const doc = await charRef.get();

    if (!doc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: "Karakter tidak ditemukan" }) };
    }
    
    // Uncomment baris ini jika ingin hanya pembuat yang bisa menghapus:
    // if (doc.data().creatorId !== userId) return { statusCode: 403, body: "Bukan milikmu!" };

    // 4. Hapus Dokumen
    await charRef.delete();

    return { 
      statusCode: 200, 
      body: JSON.stringify({ message: "Berhasil dihapus", id: charId }) 
    };

  } catch (error) {
    console.error("Delete Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};