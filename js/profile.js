// js/profile.js

// Pastikan firebase sudah di-load dari firebase-config.js
const auth = firebase.auth();
const db = firebase.firestore();

// Elemen UI
const ui = {
    avatar: document.getElementById('user-avatar'),
    displayName: document.getElementById('display-name'),
    rankName: document.getElementById('rank-name'),
    levelNum: document.getElementById('level-num'),
    currentXp: document.getElementById('current-xp'),
    maxXp: document.getElementById('max-xp'),
    xpBar: document.getElementById('xp-bar'),
    stats: {
        chat: document.getElementById('stat-chat-count'),
        hearts: document.getElementById('stat-hearts'),
        streak: document.getElementById('stat-streak')
    },
    badges: document.querySelectorAll('.badge'),
    btnEdit: document.getElementById('btn-edit-profile')
};

// --- FUNGSI UTAMA ---
document.addEventListener('DOMContentLoaded', () => {
    // Cek Status Login
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("User terdeteksi:", user.uid);
            loadUserProfile(user);
        } else {
            console.log("User belum login, kembali ke index.");
            window.location.href = 'index.html';
        }
    });

    // Event Listener Tombol Edit
    ui.btnEdit.addEventListener('click', () => {
        updateDisplayName();
    });
});

// --- LOAD DATA USER DARI FIRESTORE ---
async function loadUserProfile(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();

        if (userDoc.exists) {
            const data = userDoc.data();
            renderProfile(user, data);
        } else {
            console.log("Dokumen user tidak ditemukan, membuat baru...");
            // Jika user baru pertama kali login dan belum ada di DB
            const defaultData = createNewUserData(user);
            await db.collection('users').doc(user.uid).set(defaultData);
            renderProfile(user, defaultData);
        }
    } catch (error) {
        console.error("Gagal mengambil data profil:", error);
        alert("Terjadi kesalahan memuat profil.");
    }
}

// --- RENDER TAMPILAN ---
function renderProfile(user, data) {
    // 1. Info Dasar
    ui.displayName.textContent = data.displayName || user.displayName || "Pengguna Baru";
    ui.avatar.src = data.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
    
    // 2. Hitung Level & XP (Logika Sederhana)
    // Rumus: Level naik setiap 100 XP. Sisa XP ditampilkan.
    const totalXp = data.xp || 0;
    const level = Math.floor(totalXp / 100) + 1;
    const currentLevelXp = totalXp % 100;
    const nextLevelXp = 100; // Target XP per level (bisa diubah jadi dinamis)

    ui.levelNum.textContent = level;
    ui.currentXp.textContent = currentLevelXp;
    ui.maxXp.textContent = nextLevelXp;
    
    // Animasi Bar XP
    const xpPercentage = (currentLevelXp / nextLevelXp) * 100;
    setTimeout(() => {
        ui.xpBar.style.width = `${xpPercentage}%`;
    }, 500); // Delay sedikit biar ada efek animasi

    // 3. Tentukan Rank (Gelar)
    ui.rankName.textContent = getRankName(level);

    // 4. Statistik
    ui.stats.chat.textContent = data.stats?.totalChats || 0;
    ui.stats.hearts.textContent = data.stats?.hearts || 0;
    ui.stats.streak.textContent = (data.stats?.streak || 0) + " Hari";

    // 5. Lencana (Badges)
    checkBadges(data);
}

// --- LOGIKA HELPER ---

function getRankName(level) {
    if (level < 5) return "Pemula";
    if (level < 10) return "Warga Aktif";
    if (level < 20) return "Sepuh Chat";
    if (level < 50) return "Admin Bayangan";
    return "Dewa Koding";
}

function checkBadges(data) {
    // Contoh logika badge: Index 1 terbuka jika chat > 100
    // Ini harus disesuaikan dengan urutan badge di HTML
    const totalChats = data.stats?.totalChats || 0;
    
    // Badge 0: Akun Terdaftar (Selalu Unlock)
    unlockBadge(0); 

    // Badge 1: Ngobrol 100x
    if (totalChats >= 100) unlockBadge(1);

    // Badge 2: Sahabat Mai (Contoh: Hati > 50)
    if ((data.stats?.hearts || 0) >= 50) unlockBadge(2);

    // Badge 3: Begadang (Contoh: Login malam hari - butuh data lastLogin)
    // Belum diimplementasi
}

function unlockBadge(index) {
    if (ui.badges[index]) {
        ui.badges[index].classList.remove('locked');
        ui.badges[index].classList.add('unlocked');
        ui.badges[index].title = "Lencana Terbuka!";
    }
}

// --- UPDATE DATA ---
function createNewUserData(user) {
    return {
        displayName: user.displayName || "User" + user.uid.substring(0, 5),
        photoURL: user.photoURL,
        email: user.email,
        xp: 0,
        stats: {
            totalChats: 0,
            hearts: 0,
            streak: 1
        },
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

async function updateDisplayName() {
    const newName = prompt("Masukkan nama panggilan baru:");
    if (newName && newName.trim().length > 0) {
        try {
            const user = auth.currentUser;
            // Update di Firestore
            await db.collection('users').doc(user.uid).update({
                displayName: newName.trim()
            });
            // Update tampilan langsung tanpa reload
            ui.displayName.textContent = newName.trim();
        } catch (error) {
            console.error("Gagal ganti nama:", error);
            alert("Gagal mengganti nama. Coba lagi.");
        }
    }
}