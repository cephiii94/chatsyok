// File: js/auth-guard.js (DIMODIFIKASI)

if (typeof firebase === 'undefined') {
    alert("Firebase belum di-load!");
} else if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

// Flag global untuk status autentikasi
let authInitializationDone = false; 
window.currentUser = null;

function setupAuthUI(user) {
    const navBuatBot = document.querySelector('a[href="create-mai.html"]');
    const navContainer = document.querySelector('.lobby-sidebar-nav');

    if (!navContainer) {
        console.warn("Auth Guard: Tidak menemukan '.lobby-sidebar-nav'.");
    }

    if (user) {
        // --- USER SUDAH LOGIN ---
        console.log('Auth Guard: User login', user.uid);
        window.currentUser = user;
        if (navBuatBot) navBuatBot.style.display = 'block';

        // Hapus tombol "Login" jika ada
        const loginBtn = document.getElementById('nav-login-btn');
        if (loginBtn) loginBtn.remove();
        
        // Tambahkan tombol "Logout" jika belum ada
        if (navContainer && !document.getElementById('nav-logout-btn')) {
            const logoutBtn = document.createElement('a');
            logoutBtn.id = 'nav-logout-btn';
            logoutBtn.href = '#';
            logoutBtn.textContent = 'Logout';
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                auth.signOut().then(() => {
                    window.location.href = 'login.html'; // Arahkan ke login setelah logout
                });
            });
            navContainer.appendChild(logoutBtn);
        }

        // Cek custom claims untuk Admin
        user.getIdTokenResult(true).then((idTokenResult) => {
            if (idTokenResult.claims.admin) {
                console.log('Auth Guard: ADMIN user terdeteksi!');
                // Di sini Anda bisa menambahkan tombol/link ke panel admin
                // Cth: const adminBtn = document.getElementById('nav-admin-btn');
                // if (adminBtn) adminBtn.style.display = 'block';
            }
        });

    } else {
        // --- USER BELUM LOGIN ---
        console.log('Auth Guard: User logout (Tamu)');
        window.currentUser = null;
        if (navBuatBot) navBuatBot.style.display = 'none'; // Sembunyikan "Buat Bot"

        // Hapus tombol "Logout" jika ada
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) logoutBtn.remove();
        
        // Tambahkan tombol "Login" jika belum ada
        if (navContainer && !document.getElementById('nav-login-btn')) {
            const loginBtn = document.createElement('a');
            loginBtn.id = 'nav-login-btn';
            loginBtn.href = 'login.html';
            loginBtn.textContent = 'Login';
            navContainer.appendChild(loginBtn);
        }

        // Jika user tamu mencoba mengakses halaman yang dilindungi
        const currentPath = window.location.pathname;
        if (currentPath.includes('chat.html') || currentPath.includes('create-mai.html')) {
            console.log('Auth Guard: Akses ditolak, mengalihkan ke login.');
            alert('Anda harus login untuk mengakses halaman ini.');
            window.location.href = 'login.html';
        }

        // Tampilkan popup di index.html (halaman lobi)
        if (currentPath.endsWith('index.html') || currentPath.endsWith('/')) {
            showGuestLoginPopup();
        }
    }

    // Tandai bahwa auth selesai
    authInitializationDone = true;
    // Kirim event kustom bahwa auth sudah siap
    document.dispatchEvent(new CustomEvent('authReady', { detail: { user: user } }));
}

// Fungsi untuk menampilkan popup
function showGuestLoginPopup() {
    const modal = document.getElementById('guest-login-modal');
    const closeModalBtn = document.getElementById('close-guest-modal');
    
    // Cek sessionStorage
    if (sessionStorage.getItem('loginPopupShown')) {
        return; // Sudah ditampilkan di sesi ini
    }

    if (modal && closeModalBtn) {
        modal.style.display = 'flex'; // Tampilkan modal
        setTimeout(() => modal.classList.add('visible'), 10); // Trigger animasi fade-in

        const closeModal = () => {
            modal.classList.remove('visible');
            setTimeout(() => {
                if (modal.style.display !== 'none') { // Cek jika belum ditutup
                    modal.style.display = 'none';
                    sessionStorage.setItem('loginPopupShown', 'true'); // Tandai sudah tampil
                }
            }, 300); // Sembunyikan setelah transisi
        };
        
        closeModalBtn.addEventListener('click', closeModal, { once: true });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { // Hanya tutup jika klik di overlay
                closeModal();
            }
        }, { once: true });
    }
}

// Panggil fungsi ini saat DOM dimuat
document.addEventListener('DOMContentLoaded', () => {
    // Pantau status auth
    auth.onAuthStateChanged(setupAuthUI);
});