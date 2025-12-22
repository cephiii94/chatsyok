// vn-chat/lobby.js
// VERSI: STRICTLY STORY MODE

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

    // Tombol Back di sini kembali ke Index Utama (Home)
    if (btnTopBack) btnTopBack.addEventListener('click', () => window.location.href = '../index.html');

    // Cek Firebase & Load Data
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = '../login.html';
            } else {
                // Header settings...
                const headerTitle = document.querySelector('.lobby-header h1');
                const headerDesc = document.querySelector('.lobby-header p');
                if(headerTitle) headerTitle.textContent = "Story Mode";
                if(headerDesc) headerDesc.textContent = "Selesaikan misi dan buka ending rahasia.";
                
                // Pastikan loader NYALA di awal (HTML sudah class 'active', tapi kita pastikan lagi)
                const loader = document.getElementById('page-loader');
                if(loader) loader.classList.add('active');

                // LOAD DATA
                try {
                    await Promise.all([fetchAllCharacters(), fetchUserProgress()]);
                    renderCharacters('story');
                } catch (e) {
                    console.error("Error init:", e);
                } finally {
                    // [PENTING] Matikan Loader setelah selesai (sukses/gagal)
                    if(loader) {
                        // Fade out effect
                        loader.style.opacity = '0';
                        setTimeout(() => {
                            loader.classList.remove('active'); 
                            loader.style.opacity = ''; // Reset
                        }, 500);
                    }
                }
            }
        });
    }
});

// --- 3. FETCH DATA DARI SERVER ---

// Ambil Data Karakter (termasuk list Chapters dari DB)
async function fetchAllCharacters() {
 //   const container = document.getElementById('character-grid');
 //   if(container) container.innerHTML = '<p style="text-align:center; color:#fff;">Menyiapkan data...</p>';

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

// Ambil Progress User (Chapter mana yang sudah selesai)
async function fetchUserProgress() {
    try {
        const token = await getAuthTokenSafe();
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
        currentUserProgress = {}; 
    }
}

// --- 4. RENDER & LOGIC ---

function renderCharacters(mode) {
    const container = document.getElementById('character-grid');
    if (!container) return;
    
    container.innerHTML = '';

    // FILTER LOGIC (Khusus Story)
    const filteredChars = cachedCharacters.filter(char => {
        if (!char.isVnAvailable) return false;
        // Syarat Story: Cukup punya Game Goal
        return char.gameGoal && char.gameGoal.trim().length > 0;
    });

    if (filteredChars.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; width:100%; color:white; margin-top:50px;">
                <h3>Belum ada skenario cerita 😢</h3>
                <p>Nantikan update cerita dari kreator favoritmu.</p>
                <button onclick="location.reload()" style="background:white; color:#333; border:none; padding:10px 20px; border-radius:20px; cursor:pointer; margin-top:10px;">Refresh</button>
            </div>
        `;
        return;
    }

    filteredChars.forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card'; 

        const imageSrc = char.image || 'https://via.placeholder.com/150';
        // Badge Story
        const badgeColor = 'linear-gradient(45deg, #667eea, #764ba2)';
        const badgeText = '🎮 Story';
        const badgeTextColor = 'white';

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
            showBriefingModal(char);
        };

        container.appendChild(card);
    });
}

// --- 5. MODAL BRIEFING (STORY ONLY) ---

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

    // B. Render Daftar Chapter
    const chapterListEl = document.getElementById('chapter-list');
    if (chapterListEl) {
        chapterListEl.innerHTML = ''; 

        const chapters = char.chapters || [];
        const completedChapters = currentUserProgress[char.id] || [];

        if (chapters.length === 0) {
            chapterListEl.innerHTML = '<p style="color:#aaa; text-align:center;">Belum ada skenario tersedia.</p>';
        }

        chapters.forEach(chap => {
            const item = document.createElement('div');
            
            // Logic Lock
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
                    // Masuk ke Chat Story + Chapter ID
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