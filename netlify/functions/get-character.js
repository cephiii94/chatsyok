// File: netlify/functions/get-character.js

const admin = require('firebase-admin');

// Inisialisasi (Cek duplikasi agar tidak error di Netlify)
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
            });
        }
    } catch (e) {
        console.error("Firebase Admin Init Error:", e);
    }
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const id = event.queryStringParameters.id;

    if (!id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "ID karakter diperlukan" })
        };
    }

    try {
        const doc = await db.collection('characters').doc(id).get();

        if (!doc.exists) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: "Karakter tidak ditemukan" })
            };
        }

        const data = doc.data();

        // Mapping Data agar sesuai dengan chat.js
        const characterData = {
            id: doc.id,
            name: data.name || "Tanpa Nama",
            description: data.description || "",
            // Mapping Gambar
            image: data.image || data.avatar || "https://placehold.co/400x600?text=No+Image",
            backgroundImage: data.backgroundImage || data.bg || "img/bg/kamar.png",
            sprites: data.sprites || {
                 idle: data.image || data.avatar || ""
            },
            greeting: data.greeting || "Halo, apa kabar?"
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(characterData)
        };

    } catch (error) {
        console.error("Error fetching character:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};