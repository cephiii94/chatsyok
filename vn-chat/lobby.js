// vn-chat/lobby.js
// VERSI: FILTER MODE FIRST (Pop-up muncul duluan, baru list karakter)

let cachedCharacters = []; // Menyimpan data mentah dari server

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
    // 1. Setup Tombol Navigasi Baru
    const btnTopBack = document.getElementById('btn-top-back');
    const btnChangeMode = document.getElementById('btn-change-mode');

    // Klik tombol pojok kanan atas -> Ke Menu Utama
    if (btnTopBack) {
        btnTopBack.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }

    // Klik tombol Ganti Mode -> Buka Modal lagi
    if (btnChangeMode) {
        btnChangeMode.addEventListener('click', () => {
            showModeSelectionModal(true); // Parameter true artinya "ganti mode"
        });
    }

    // 2. Cek Firebase (Standard)
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                window.location.href = '../login.html';
            } else {
                // Tampilkan modal hanya jika belum ada mode terpilih (opsional)
                // Tapi logika Tuan sebelumnya "Show First", jadi kita panggil:
                showModeSelectionModal(); 
                fetchAllCharacters();
            }
        });
    }
});

// --- 3. LOGIKA MODAL ---
function showModeSelectionModal(isSwitching = false) {
    const modal = document.getElementById('mode-selection-modal');
    const btnFree = document.getElementById('btn-mode-free');
    const btnStory = document.getElementById('btn-mode-story');
    const btnCancel = document.getElementById('btn-cancel-mode');
    const headerTitle = document.querySelector('.lobby-header h1');
    const headerDesc = document.querySelector('.lobby-header p');

    if (!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // --- KLIK FREE MODE ---
    btnFree.onclick = () => {
        modal.style.display = 'none';
        if(headerTitle) headerTitle.textContent = "Mode Santai (Free Talk)";
        if(headerDesc) headerDesc.textContent = "Pilih teman untuk ngobrol bebas.";
        renderCharacters('free');
    };

    // --- KLIK STORY MODE ---
    btnStory.onclick = () => {
        modal.style.display = 'none';
        if(headerTitle) headerTitle.textContent = "Mode Cerita (Story)";
        if(headerDesc) headerDesc.textContent = "Pilih skenario petualanganmu.";
        renderCharacters('story');
    };

    // --- KLIK BATAL ---
    if (btnCancel) {
        if (isSwitching) {
            // Jika user cuma mau ganti mode tapi gak jadi -> Tutup aja modalnya
            btnCancel.textContent = "Tutup";
            btnCancel.onclick = () => {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            };
        } else {
            // Jika user baru masuk halaman -> Kembali ke Index
            btnCancel.textContent = "Kembali ke Menu Utama";
            btnCancel.onclick = () => {
                window.location.href = '../index.html';
            };
        }
    }
}

// --- 4. DATA & RENDER ---

async function fetchAllCharacters() {
    const container = document.getElementById('character-grid');
    if(container) container.innerHTML = '<p style="text-align:center; color:#fff;">Menyiapkan data...</p>';

    try {
        const token = await getAuthTokenSafe();
        const res = await fetch('/.netlify/functions/get-all-characters', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Gagal fetch data");
        
        cachedCharacters = await res.json();
        
        // Jangan render dulu, tunggu user pilih mode di Pop-up

    } catch (e) {
        console.error(e);
        if(container) container.innerHTML = '<p style="text-align:center; color:#ff6b6b;">Gagal memuat data.</p>';
    }
}

function renderCharacters(mode) {
    const container = document.getElementById('character-grid');
    if (!container) return;
    
    container.innerHTML = '';

    // FILTER LOGIC
    const filteredChars = cachedCharacters.filter(char => {
        // Syarat Dasar: Harus VN Available
        if (!char.isVnAvailable) return false;

        if (mode === 'story') {
            // Syarat Story: Harus punya Game Goal
            return char.gameGoal && char.gameGoal.trim().length > 0;
        } else {
            // Syarat Free: Semua yang VN Available boleh masuk
            return true;
        }
    });

    // Handle Kosong
    if (filteredChars.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; width:100%; color:white; margin-top:50px;">
                <h3>Belum ada karakter untuk mode ini 😢</h3>
                <p>Coba pilih mode lain atau buat karakter baru.</p>
                <button onclick="location.reload()" style="background:white; color:#333; border:none; padding:10px 20px; border-radius:20px; cursor:pointer; margin-top:10px;">Ganti Mode</button>
            </div>
        `;
        return;
    }

    // Render Kartu
    filteredChars.forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card'; // Pakai style CSS Tuan

        const imageSrc = char.image || 'https://via.placeholder.com/150';
        
        // Badge Opsional (Hanya kosmetik)
        const badgeColor = mode === 'story' ? 'linear-gradient(45deg, #667eea, #764ba2)' : 'linear-gradient(45deg, #a8edea, #fed6e3)';
        const badgeText = mode === 'story' ? '🎮 Story' : '☕ Free';
        const badgeTextColor = mode === 'story' ? 'white' : '#444';

        card.innerHTML = `
            <div style="position:relative;">
                <img src="${imageSrc}" alt="${char.name}" style="width:100%; height:200px; object-fit:cover; border-radius:8px 8px 0 0;">
                <span style="position:absolute; top:10px; right:10px; background:${badgeColor}; color:${badgeTextColor}; padding:4px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
                    ${badgeText}
                </span>
            </div>
            <div style="padding:15px;">
                <h3 style="margin:0 0 5px 0; font-size:1.1rem; color:#333;">${char.name}</h3>
                <p style="margin:0; font-size:0.85rem; color:#666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${char.tagline || char.description || '...'}
                </p>
            </div>
        `;

        // Style Inline (Fallback jika CSS belum load)
        card.style.cssText = `
            background: white; border-radius: 12px; overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); cursor: pointer;
            transition: transform 0.2s;
        `;
        card.onmouseover = () => card.style.transform = 'translateY(-5px)';
        card.onmouseout = () => card.style.transform = 'translateY(0)';

        // KLIK KARTU -> Masuk Chat Sesuai Mode
        card.onclick = () => {
            // Langsung lempar ke chat dengan mode yang sudah dipilih di awal
            window.location.href = `chat.html?id=${char.id}&mode=${mode}`;
        };

        container.appendChild(card);
    });
}