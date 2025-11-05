// File: js/auth-guard.js

// Inisialisasi Firebase (jika belum ada)
if (typeof firebase === 'undefined') {
    alert("Firebase belum di-load!");
} else if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

function setupAuthUI() {
    const navBuatBot = document.querySelector('a[href="create-mai.html"]');
    const navPengaturan = document.querySelector('a[href="#"]'); // Placeholder
    const navContainer = document.querySelector('.lobby-sidebar-nav');

    if (!navContainer) return;

    auth.onAuthStateChanged((user) => {
        if (user) {
            // --- USER SUDAH LOGIN ---
            console.log('Auth Guard: User login', user.uid);
            if (navBuatBot) navBuatBot.style.display = 'block'; // Tampilkan tombol "Buat Bot"

            // Hapus tombol "Login" jika ada
            const loginBtn = document.getElementById('nav-login-btn');
            if (loginBtn) loginBtn.remove();
            
            // Tambahkan tombol "Logout" jika belum ada
            if (!document.getElementById('nav-logout-btn')) {
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

        } else {
            // --- USER BELUM LOGIN ---
            console.log('Auth Guard: User logout');
            if (navBuatBot) navBuatBot.style.display = 'none'; // Sembunyikan "Buat Bot"

            // Hapus tombol "Logout" jika ada
            const logoutBtn = document.getElementById('nav-logout-btn');
            if (logoutBtn) logoutBtn.remove();
            
            // Tambahkan tombol "Login" jika belum ada
            if (!document.getElementById('nav-login-btn')) {
                const loginBtn = document.createElement('a');
                loginBtn.id = 'nav-login-btn';
                loginBtn.href = 'login.html';
                loginBtn.textContent = 'Login';
                navContainer.appendChild(loginBtn);
            }
        }
    });
}

// Panggil fungsi ini saat DOM dimuat
document.addEventListener('DOMContentLoaded', setupAuthUI);