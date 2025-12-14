// js/leaderboard.js

const auth = firebase.auth();
const db = firebase.firestore();

const listContainer = document.getElementById('leaderboard-list');
const spinner = document.getElementById('loading-spinner');
const myRankBar = document.getElementById('my-rank-bar');

// --- START ---
document.addEventListener('DOMContentLoaded', () => {
    // Tunggu Auth siap dulu baru load data
    auth.onAuthStateChanged(user => {
        loadLeaderboard(user);
    });
});

async function loadLeaderboard(currentUser) {
    try {
        // 1. Query Top 50 User berdasarkan XP tertinggi
        // Pastikan Tuan sudah punya Collection 'users' dengan field 'xp'
        const snapshot = await db.collection('users')
                                 .orderBy('xp', 'desc')
                                 .limit(50)
                                 .get();

        spinner.style.display = 'none';
        listContainer.innerHTML = '';

        if (snapshot.empty) {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px;">Belum ada data pemain.</div>';
            return;
        }

        let rank = 1;
        let myRankData = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            const isMe = currentUser && currentUser.uid === doc.id;
            
            // Render item
            renderListItem(rank, data, isMe);

            // Simpan data rank sendiri jika ketemu
            if (isMe) {
                myRankData = { rank, ...data };
            }
            rank++;
        });

        // Tampilkan sticky bar di bawah untuk posisi kita sendiri
        if (currentUser && myRankData) {
            showMyRank(myRankData);
        }

    } catch (error) {
        console.error("Gagal load leaderboard:", error);
        spinner.innerHTML = `<p style="color:red">Gagal memuat data.<br><small>${error.message}</small></p>`;
        
        // TIPS DEBUGGING:
        // Jika errornya "The query requires an index", buka link yang muncul di console browser!
        // Firebase butuh index untuk sorting 'xp' desc.
    }
}

function renderListItem(rank, data, isMe) {
    const item = document.createElement('div');
    
    // Tentukan kelas khusus untuk Top 3
    let specialClass = '';
    let rankDisplay = rank;
    
    if (rank === 1) { specialClass = 'top-1'; rankDisplay = '👑'; }
    else if (rank === 2) { specialClass = 'top-2'; rankDisplay = '🥈'; }
    else if (rank === 3) { specialClass = 'top-3'; rankDisplay = '🥉'; }

    item.className = `lb-item ${specialClass}`;
    if (isMe) item.style.background = '#e3f2fd'; // Highlight kalau itu kita

    // Avatar default jika user belum punya foto
    const avatarUrl = data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.displayName || 'Guest'}`;
    const displayName = data.displayName || 'Tanpa Nama';
    const xp = data.xp || 0;
    const level = Math.floor(xp / 100) + 1;

    item.innerHTML = `
        <div class="rank-badge">${rankDisplay}</div>
        <div class="user-info">
            <img src="${avatarUrl}" class="user-avatar" alt="Avatar">
            <span class="user-name">${displayName} ${isMe ? '(Anda)' : ''}</span>
        </div>
        <div class="stats-info">
            <span class="lvl-text">Lvl. ${level}</span>
            <span class="xp-text">${formatNumber(xp)} XP</span>
        </div>
    `;

    listContainer.appendChild(item);
}

function showMyRank(data) {
    myRankBar.classList.remove('hidden');
    document.getElementById('my-rank-pos').textContent = data.rank;
    document.getElementById('my-name').textContent = (data.displayName || 'Anda') + " (Posisi Anda)";
    document.getElementById('my-xp').textContent = formatNumber(data.xp || 0) + " XP";
    document.getElementById('my-avatar').src = data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.displayName}`;
}

// Helper: Format angka (contoh: 1200 jadi 1.2k atau 1,200)
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}`          `