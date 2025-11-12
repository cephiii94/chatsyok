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
    
    // BARU: Ambil link admin
    const adminLink = document.getElementById('nav-admin-link');

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

        // MODIFIKASI: Cek custom claims untuk Admin
        // 'true' memaksa refresh token untuk mendapatkan claims terbaru
        user.getIdTokenResult(true).then((idTokenResult) => {
            if (idTokenResult.claims.admin) {
                console.log('Auth Guard: ADMIN user terdeteksi!');
                // Tampilkan link Admin jika ada
                if (adminLink) {
                    adminLink.style.display = 'block';
                }
            } else {
                // Pastikan link admin tersembunyi jika bukan admin
                if (adminLink) {
                    adminLink.style.display = 'none';
                }
            }
        });

    } else {
        // --- USER BELUM LOGIN ---
        console.log('Auth Guard: User logout (Tamu)');
        window.currentUser = null;
        if (navBuatBot) navBuatBot.style.display = 'none'; // Sembunyikan "Buat Bot"

        // Sembunyikan link admin jika user adalah tamu
        if (adminLink) {
            adminLink.style.display = 'none';
        }

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
    
    if (sessionStorage.getItem('loginPopupShown')) {
        return;
    }

    if (modal && closeModalBtn) {
        modal.style.display = 'flex'; 
        setTimeout(() => modal.classList.add('visible'), 10); 

        const closeModal = () => {
            modal.classList.remove('visible');
            setTimeout(() => {
                if (modal.style.display !== 'none') {
                    modal.style.display = 'none';
                    sessionStorage.setItem('loginPopupShown', 'true');

                    // Hapus event listener setelah ditutup
                    closeModalBtn.removeEventListener('click', closeModal);
                    modal.removeEventListener('click', overlayClick);
                }
            }, 300); 
        };
        
        const overlayClick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };

        closeModalBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', overlayClick);
    }
}

// Panggil fungsi ini saat DOM dimuat
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(setupAuthUI);
});