// File: netlify/functions/get-character.js
// VERSI: FIXED (Mengembalikan Semua Data untuk Edit)

const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
            });
        }
    } catch (e) { console.error("Firebase Init Error:", e); }
}
const db = admin.firestore();

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    const id = event.queryStringParameters.id;
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: "No ID" }) };

    try {
        const doc = await db.collection('characters').doc(id).get();
        if (!doc.exists) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not Found" }) };

        const data = doc.data();

        // [BRI FIXED] Gunakan spread operator (...) agar semua field terbawa
        // Termasuk storyChapters, mode, gameGoal yang sebelumnya hilang.
        const characterData = {
            id: doc.id,
            ...data, 
            
            // Default values untuk mencegah frontend error jika field kosong
            name: data.name || "Tanpa Nama",
            image: data.image || data.avatar || "https://placehold.co/400x600",
            sprites: data.sprites || { idle: data.image || "" },
            storyChapters: data.storyChapters || [] // Pastikan ini ada!
        };

        return { statusCode: 200, headers, body: JSON.stringify(characterData) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};