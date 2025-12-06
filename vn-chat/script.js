// vn-chat/script.js

let currentEmotion = 'idle';
// Sesuaikan URL ini dengan gambar aset Anda
const sprites = {
    'IDLE': 'https://url-gambar-anda/mai_idle.png',
    'HAPPY': 'https://url-gambar-anda/mai_happy.png',
    'SAD': 'https://url-gambar-anda/mai_sad.png',
    'ANGRY': 'https://url-gambar-anda/mai_angry.png',
    // ... dst
};

document.getElementById('btn-send').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;

    // Tampilkan pesan user (bisa dibuat bubble kecil atau langsung kirim)
    input.value = '';
    input.disabled = true;
    
    // Efek mengetik sementara...
    document.getElementById('dialogue-text').innerText = "Sedang berpikir...";

    try {
        const token = await window.currentUser.getIdToken();
        const charId = "1"; // ID MAI Default atau ambil dari URL param
        
        // Panggil Backend BARU (yang ada -vn)
        const res = await fetch('/.netlify/functions/get-chat-response-vn', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                userMessage: text,
                characterId: charId,
                sessionId: 'session-vn-demo', // Bisa digenerate dynamic
                // ... data lain yg dibutuhkan backend
            })
        });

        const data = await res.json();
        const rawReply = data.reply; // Contoh: "[HAPPY] Halo Tuan!"

        // --- LOGIKA PARSING EMOSI ---
        let cleanText = rawReply;
        let detectedEmotion = 'IDLE';

        // Regex untuk mencari [TEXT] di awal string
        const emotionMatch = rawReply.match(/^\[([A-Z]+)\]/);
        
        if (emotionMatch) {
            detectedEmotion = emotionMatch[1]; // Dapat "HAPPY"
            cleanText = rawReply.replace(emotionMatch[0], '').trim(); // Hapus tag dari teks
        }

        // 1. Ganti Gambar
        updateSprite(detectedEmotion);

        // 2. Tampilkan Teks (Efek mengetik)
        typewriter(cleanText);

    } catch (e) {
        console.error(e);
        document.getElementById('dialogue-text').innerText = "Error koneksi...";
    } finally {
        input.disabled = false;
        input.focus();
    }
}

function updateSprite(emotion) {
    const imgEl = document.getElementById('char-sprite');
    // Jika ada gambar untuk emosi tsb, ganti. Jika tidak, pakai idle.
    const newSrc = sprites[emotion] || sprites['IDLE'];
    
    if (imgEl.src !== newSrc) {
        imgEl.style.opacity = 0; // Fade out dikit
        setTimeout(() => {
            imgEl.src = newSrc;
            imgEl.style.opacity = 1;
        }, 150);
    }
}

function typewriter(text) {
    const el = document.getElementById('dialogue-text');
    el.innerText = "";
    let i = 0;
    const speed = 30; // Kecepatan ketik ms

    function type() {
        if (i < text.length) {
            el.innerText += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}