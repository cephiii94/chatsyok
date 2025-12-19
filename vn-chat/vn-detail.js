// vn-chat/vn-detail.js

// --- 1. SETUP DATA CHAPTER (Nanti bisa dipindah ke Database) ---
// Ini konfigurasi chapter manual dulu ya Tuan, biar jalan.
const STORY_CONFIG = {
    '1': [ // ID Karakter 1 (MAI)
        { id: 'chap1', title: 'Chapter 1: Pertemuan Awal', desc: 'Sapa Mai dan buat dia nyaman.', required: null },
        { id: 'chap2', title: 'Chapter 2: Rahasia Kecil', desc: 'Mai mulai terbuka tentang masa lalunya.', required: 'chap1' },
        { id: 'chap3', title: 'Chapter 3: Konflik Batin', desc: 'Bantu Mai mengambil keputusan sulit.', required: 'chap2' }
    ]
    // Tambahkan karakter lain di sini nanti
};

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const charId = params.get('id');

    if (!charId) {
        alert("Karakter tidak ditemukan!");
        window.location.href = 'lobby.html';
        return;
    }

    // Load Data
    await loadCharacterDetails(charId);
});

async function loadCharacterDetails(charId) {
    const container = document.getElementById('main-content');
    const loading = document.getElementById('loading');

    try {
        // 1. Fetch Data Karakter (Nama, Foto, Bio)
        // Kita pakai endpoint yang sudah Tuan punya
        const res = await fetch(`/.netlify/functions/get-character?id=${charId}`);
        const char = await res.json();

        // Render Data Statis
        document.getElementById('char-name').textContent = char.name;
        document.getElementById('char-desc').textContent = char.description;
        document.getElementById('char-goal').textContent = char.gameGoal || "Selesaikan cerita.";
        
        // Background Image (Kalau ada, kalau gak ada pakai default)
        const bgUrl = char.image || 'https://via.placeholder.com/800x400';
        document.getElementById('hero-bg').style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0), #1a1a2e), url('${bgUrl}')`;

        // 2. Fetch Progress User (SIMULASI)
        // Nanti ganti ini dengan fetch ke database Firebase user
        // Contoh: const userProgress = await fetchUserProgress(uid, charId);
        const userProgress = ['chap1']; // <--- Ceritanya user baru kelar chapter 1

        // 3. Render Chapters
        renderChapters(charId, userProgress);

        loading.style.display = 'none';
        container.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        loading.innerHTML = "Gagal memuat data. Coba refresh.";
    }
}

function renderChapters(charId, completedChapters) {
    const container = document.getElementById('chapters-container');
    const chapters = STORY_CONFIG[charId] || []; // Ambil daftar chapter

    if (chapters.length === 0) {
        container.innerHTML = "<p>Belum ada skenario cerita untuk karakter ini.</p>";
        return;
    }

    chapters.forEach(chap => {
        // Logika Kunci Gembok
        // Chapter terkunci jika: Ada syarat (required), TAPI syarat itu belum ada di daftar completed
        let isLocked = false;
        if (chap.required && !completedChapters.includes(chap.required)) {
            isLocked = true;
        }

        const card = document.createElement('div');
        card.className = `chapter-card ${isLocked ? 'locked' : ''}`;
        
        const icon = isLocked ? '🔒' : '▶️';
        const statusText = isLocked ? 'Terkunci' : 'Mulai';

        card.innerHTML = `
            <div>
                <h3 style="margin:0;">${chap.title}</h3>
                <p style="margin:5px 0 0 0; font-size:0.9rem; opacity:0.8;">${chap.desc}</p>
            </div>
            <div style="font-size:1.5rem; margin-left:15px;">
                ${icon}
            </div>
        `;

        if (!isLocked) {
            card.onclick = () => {
                // Masuk ke Chat dengan parameter Chapter
                window.location.href = `chat.html?id=${charId}&mode=story&chapter=${chap.id}`;
            };
        } else {
            card.onclick = () => {
                alert(`Selesaikan "${chap.required}" dulu untuk membuka ini!`);
            };
        }

        container.appendChild(card);
    });
}