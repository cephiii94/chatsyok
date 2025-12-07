// vn-chat/script.js (Complete Version)

let currentCharacterId = "1"; // Default ID
let currentCharacterName = "MAI";
let currentCharacterProfile = "MAI default, ramah, dan membantu.";
let currentUser = null; // Dari auth-guard
let currentSessionId = 'session-vn-demo'; // Sesi demo untuk VN mode
let currentEmotion = 'IDLE';

// Peta emosi (Sesuaikan URL ini dengan gambar aset Anda)
// Catatan: Saya menggunakan path lokal yang tersedia
const sprites = {
    'IDLE': '/vn-chat/img/char/bri/idle.png',
    'HAPPY': '/vn-chat/img/char/bri/idle.png', // Ganti dengan happy.png jika ada
    'SAD': '/vn-chat/img/char/bri/idle.png',   // Ganti dengan sad.png jika ada
    'ANGRY': '/vn-chat/img/char/bri/idle.png', // Ganti dengan angry.png jika ada
    'SURPRISED': '/vn-chat/img/char/bri/idle.png', // Ganti
    'SHY': '/vn-chat/img/char/bri/idle.png',     // Ganti
    'THINKING': '/vn-chat/img/char/bri/idle.png', // Ganti
    // Tambahkan lebih banyak jika Anda punya file gambar untuk setiap emosi
};

// --- Helper Functions ---

// Fungsi untuk menampilkan teks dengan efek mengetik
function typewriter(text) {
    const el = document.getElementById('dialogue-text');
    el.textContent = ""; // Use textContent
    let i = 0;
    const speed = 30; // Kecepatan ketik ms

    function type() {
        if (i < text.length) {
            el.textContent += text.charAt(i); // Use textContent
            i++;
            setTimeout(type, speed);
        } else {
            // Setelah selesai mengetik, aktifkan kembali input
            document.getElementById('user-input').disabled = false;
            document.getElementById('btn-send').disabled = false;
            document.getElementById('user-input').focus();
        }
    }
    type();
}

// Fungsi untuk mengganti gambar sprite karakter berdasarkan emosi
function updateSprite(emotion) {
    const normalizedEmotion = emotion in sprites ? emotion : 'IDLE';
    const imgEl = document.getElementById('char-sprite');
    const newSrc = sprites[normalizedEmotion];

    if (imgEl.src !== newSrc) {
        imgEl.style.opacity = 0;
        setTimeout(() => {
            imgEl.src = newSrc;
            imgEl.style.opacity = 1;
        }, 150);
        currentEmotion = normalizedEmotion;
    }
}

// Fungsi untuk memuat profil karakter dari Netlify Function
async function loadCharacterProfile() {
    const params = new URLSearchParams(window.location.search);
    currentCharacterId = params.get('id') || '1';

    try {
        const res = await fetch(`/.netlify/functions/get-character?id=${currentCharacterId}`);
        if (!res.ok) throw new Error("Karakter tidak ditemukan");

        const char = await res.json();
        currentCharacterProfile = char.description;
        currentCharacterName = char.name;

        document.getElementById('char-name').textContent = char.name;
        // Tampilkan sapaan awal
        typewriter(char.greeting || "Halo! Apa yang ingin kamu bicarakan?");

    } catch (e) {
        console.error("Gagal memuat profil karakter:", e);
        document.getElementById('dialogue-text').textContent = `Error: Gagal memuat data karakter. ${e.message}`;
    }
}

// --- Main Logic ---

// Fungsi untuk mengirim pesan ke AI
async function sendMessage() {
    const input = document.getElementById('user-input');
    const sendBtn = document.getElementById('btn-send');
    const text = input.value.trim();
    if (!text) return;

    // Disable input dan tombol
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    document.getElementById('dialogue-text').innerText = "Sedang berpikir...";

    try {
        // Ambil token dari Firebase
        const auth = firebase.auth();
        const user = auth.currentUser;
        if (!user) throw new Error("User not logged in");
        const token = await user.getIdToken();

        // Panggil Backend VN
        const res = await fetch('/.netlify/functions/get-chat-response-vn', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                userMessage: text,
                characterProfile: currentCharacterProfile,
                characterName: currentCharacterName,
                characterId: currentCharacterId,
                sessionId: currentSessionId,
                // Di sini Anda bisa menambahkan userPersona jika Anda sudah mengaturnya
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Gagal dari Netlify Function');
        }

        // Simpan pesan di database agar riwayat terakumulasi
        await saveMessage('user', text);

        const data = await res.json();
        const rawReply = data.reply;

        // --- LOGIKA PARSING EMOSI ---
        let cleanText = rawReply;
        let detectedEmotion = 'IDLE';

        // Regex untuk mencari [TEXT] di awal string
        const emotionMatch = rawReply.match(/^\[([A-Z]+)\]/);

        if (emotionMatch) {
            detectedEmotion = emotionMatch[1];
            cleanText = rawReply.replace(emotionMatch[0], '').trim();
        }

        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        // 1. Ganti Gambar
        updateSprite(detectedEmotion);

        // 2. Tampilkan Teks (Efek mengetik)
        typewriter(cleanText);

        // Simpan balasan bot
        await saveMessage('bot', cleanText);

    } catch (e) {
        console.error("VN Chat Error:", e);
        document.getElementById('dialogue-text').innerText = `[SAD] Aduh, ada masalah server. Error: ${e.message}`;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// Fungsi untuk menyimpan pesan di Firestore
async function saveMessage(sender, text) {
    try {
        const auth = firebase.auth();
        const user = auth.currentUser;
        if (!user) {
            console.error("Tidak bisa menyimpan pesan: User belum login.");
            return;
        }
        const token = await user.getIdToken();

        await fetch('/.netlify/functions/save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ characterId: currentCharacterId, sender, text, sessionId: currentSessionId })
        });
    } catch (e) {
        console.error("Gagal menyimpan pesan:", e);
    }
}


// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tunggu autentikasi selesai (dari auth-guard.js)
    if (!window.currentUser) {
        // authReady adalah CustomEvent yang dikirim dari auth-guard.js
        await new Promise(resolve => document.addEventListener('authReady', resolve, { once: true }));
    }
    currentUser = window.currentUser;
    if (!currentUser) return (window.location.href = '../login.html'); // Arahkan ke login jika belum login

    // 2. Load Profile Karakter
    // Panggil loadCharacterProfile sebelum setup listener untuk menghindari race condition
    await loadCharacterProfile();

    // 3. Setup Listeners
    document.getElementById('btn-send').addEventListener('click', sendMessage);
    document.getElementById('user-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});