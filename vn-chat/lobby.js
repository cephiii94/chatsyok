// vn-chat/lobby.js
// VERSI: FIREBASE INTEGRATION (Real Data)

let cachedCharacters = []; // Data karakter (termasuk chapters)
let currentUserProgress = {}; // Data progress user

// --- 1. HELPER AUTH ---
function getAuthTokenSafe() {
    return new Promise((resolve, reject) => {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            return reject(new Error("Firebase SDK belum siap."));
        }
        const auth = firebase.auth();
        const user = auth.currentUser;
        if (user) {
            user.getIdToken(true).then(resolve).catch(reject);
        } else {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                if (user) {
                    user.getIdToken(true).then(resolve).catch(reject);
                } else {
                    reject(new Error("User tidak login."));
                }
            });
        }
    });
}

// --- 2. INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    // Setup Tombol Navigasi
    const btnTopBack = document.getElementById('btn-top-back');
    const btnChangeMode = document.getElementById('btn-change-mode');

    if (btnTopBack) btnTopBack.addEventListener('click', () => window.location.href = '../index.html');
    if (btnChangeMode) btnChangeMode.addEventListener('click', () => showModeSelectionModal(true));

    // Cek Firebase & Load Data
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = '../login.html';
            } else {
                // Tampilkan modal mode selection dlu
                showModeSelectionModal(); 
                
                // LOAD DATA PARALEL (Karakter & Progress User)
                await Promise.all([fetchAllCharacters(), fetchUserProgress()]);
            }
        });
    }
});

// --- 3. FETCH DATA DARI SERVER ---

// Ambil Data Karakter (termasuk list Chapters dari DB)
async function fetchAllCharacters() {
    const container = document.getElementById('character-grid');
    if(container) container.innerHTML = '<p style="text-align:center; color:#fff;">Menyiapkan data...</p>';

    try {
        const token = await getAuthTokenSafe();
        const res = await fetch('/.netlify/functions/get-all-characters', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Gagal fetch data karakter");
        cachedCharacters = await res.json();
        
    } catch (e) {
        console.error(e);
        if(container) container.innerHTML = '<p style="text-align:center; color:#ff6b6b;">Gagal memuat data.</p>';
    }
}

// [BARU] Ambil Progress User (Chapter mana yang sudah selesai)
async function fetchUserProgress() {
    try {
        const token = await getAuthTokenSafe();
        // Panggil fungsi backend baru kita
        const res = await fetch('/.netlify/functions/get-user-progress', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            currentUserProgress = data.vnProgress || {};
            console.log("Progress User Loaded:", currentUserProgress);
        }
    } catch (e) {
        console.error("Gagal load progress:", e);
        // Kalau gagal, anggap belum ada progress (New Game)
        currentUserProgress = {}; 
    }
}

// --- 4. RENDER & LOGIC ---

function renderCharacters(mode) {
    const container = document.getElementById('character-grid');
    if (!container) return;
    
    container.innerHTML = '';

    // FILTER LOGIC
    const filteredChars = cachedCharacters.filter(char => {
        if (!char.isVnAvailable) return false;
        if (mode === 'story') {
            // Syarat Story: Harus punya Game Goal DAN punya data Chapters
            return char.gameGoal && char.chapters && char.chapters.length > 0;
        }
        return true;
    });

    if (filteredChars.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; width:100%; color:white; margin-top:50px;">
                <h3>Belum ada karakter untuk mode ini 😢</h3>
                <p>Pastikan data karakter di Firebase sudah memiliki field 'chapters'.</p>
                <button onclick="location.reload()" style="background:white; color:#333; border:none; padding:10px 20px; border-radius:20px; cursor:pointer; margin-top:10px;">Refresh</button>
            </div>
        `;
        return;
    }

    filteredChars.forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card'; 

        const imageSrc = char.image || 'https://via.placeholder.com/150';
        const badgeColor = mode === 'story' ? 'linear-gradient(45deg, #667eea, #764ba2)' : 'linear-gradient(45deg, #a8edea, #fed6e3)';
        const badgeText = mode === 'story' ? '🎮 Story' : '☕ Free';
        const badgeTextColor = mode === 'story' ? 'white' : '#444';

        card.innerHTML = `
            <div class="char-image-wrapper">
                <img src="${imageSrc}" class="char-image" alt="${char.name}">
                <span class="status-badge" style="background:${badgeColor}; color:${badgeTextColor};">
                    ${badgeText}
                </span>
            </div>
            <div class="char-info">
                <h3 class="char-name">${char.name}</h3>
                <p class="char-desc">${char.tagline || char.description || '...'}</p>
            </div>
        `;

        card.onclick = () => {
            if (mode === 'story') {
                showBriefingModal(char);
            } else {
                window.location.href = `chat.html?id=${char.id}&mode=free`;
            }
        };

        container.appendChild(card);
    });
}

// --- 5. MODAL BRIEFING (REAL DATA) ---

function showBriefingModal(char) {
    const modal = document.getElementById('briefing-modal');
    const btnClose = document.getElementById('btn-close-briefing');
    
    if (!modal) return;

    // A. Isi Data Profil
    document.getElementById('briefing-name').textContent = char.name;
    document.getElementById('briefing-desc').textContent = char.tagline || char.description || "Tidak ada deskripsi.";
    document.getElementById('briefing-goal').textContent = char.gameGoal || "Selesaikan cerita.";
    
    const imgEl = document.getElementById('briefing-img');
    if (imgEl) imgEl.src = char.image || 'https://via.placeholder.com/150';

    // B. Render Daftar Chapter (REAL DATA)
    const chapterListEl = document.getElementById('chapter-list');
    if (chapterListEl) {
        chapterListEl.innerHTML = ''; 

        // 1. Ambil List Chapter dari Object Karakter
        const chapters = char.chapters || [];

        // 2. Ambil Progress User untuk Karakter ini
        // Format di DB: vnProgress: { "charID": ["chap1", "chap2"] }
        const completedChapters = currentUserProgress[char.id] || [];

        if (chapters.length === 0) {
            chapterListEl.innerHTML = '<p style="color:#aaa; text-align:center;">Belum ada skenario tersedia.</p>';
        }

        chapters.forEach(chap => {
            const item = document.createElement('div');
            
            // Logic Lock: Terkunci jika ada syarat DAN syarat belum selesai
            const isLocked = chap.required && !completedChapters.includes(chap.required);
            
            item.className = `chapter-item ${isLocked ? 'locked' : ''}`;
            const icon = isLocked ? '🔒' : '▶️';
            const colorTitle = isLocked ? '#888' : '#fff';

            item.innerHTML = `
                <div class="chapter-info">
                    <span class="chapter-title" style="color:${colorTitle}">${chap.title}</span>
                    <span class="chapter-desc">${chap.desc}</span>
                </div>
                <div class="chapter-status">${icon}</div>
            `;

            if (!isLocked) {
                item.onclick = () => {
                    // Masuk ke Chat
                    window.location.href = `chat.html?id=${char.id}&mode=story&chapter=${chap.id}`;
                };
            } else {
                item.onclick = () => {
                    alert(`Selesaikan dulu bab sebelumnya!`);
                };
            }

            chapterListEl.appendChild(item);
        });
    }

    modal.classList.remove('hidden');
    
    if (btnClose) btnClose.onclick = () => modal.classList.add('hidden');
    window.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    };
}

// --- 6. LOGIKA MODAL MODE (BAWAAN) ---
function showModeSelectionModal(isSwitching = false) {
    const modal = document.getElementById('mode-selection-modal');
    const btnFree = document.getElementById('btn-mode-free');
    const btnStory = document.getElementById('btn-mode-story');
    const btnCancel = document.getElementById('btn-cancel-mode');
    const headerTitle = document.querySelector('.lobby-header h1');
    const headerDesc = document.querySelector('.lobby-header p');

    if (!modal) return;
    modal.classList.remove('hidden');

    btnFree.onclick = () => {
        modal.classList.add('hidden');
        if(headerTitle) headerTitle.textContent = "Mode Santai (Free Talk)";
        if(headerDesc) headerDesc.textContent = "Pilih teman untuk ngobrol bebas.";
        renderCharacters('free');
    };

    btnStory.onclick = () => {
        modal.classList.add('hidden');
        if(headerTitle) headerTitle.textContent = "Mode Cerita (Story)";
        if(headerDesc) headerDesc.textContent = "Pilih skenario petualanganmu.";
        renderCharacters('story');
    };

    if (btnCancel) {
        if (isSwitching) {
            btnCancel.textContent = "Tutup";
            btnCancel.onclick = () => modal.classList.add('hidden');
        } else {
            btnCancel.textContent = "Kembali ke Menu Utama";
            btnCancel.onclick = () => window.location.href = '../index.html';
        }
    }
}