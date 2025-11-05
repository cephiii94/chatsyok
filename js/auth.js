// File: js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi Firebase
    // Pastikan firebaseConfig sudah di-load dari firebase-config.js
    firebase.initializeApp(firebaseConfig);

    const auth = firebase.auth();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Elemen DOM ---
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const googleBtn = document.getElementById('google-signin-btn');
    const statusMsg = document.getElementById('auth-status');

    // --- Cek Status Login ---
    // Jika user sudah login, arahkan ke halaman lobi (index.html)
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('User sudah login:', user.uid);
            // Arahkan ke lobi jika sudah di halaman login
            if (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('login')) {
                 window.location.href = 'index.html';
            }
        } else {
            console.log('User logout.');
        }
    });

    // --- Event Listeners ---

    // 1. Tombol Login
    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        
        if (!email || !password) {
            showError('Email dan password tidak boleh kosong.');
            return;
        }
        
        try {
            showStatus('Mencoba login...', false);
            await auth.signInWithEmailAndPassword(email, password);
            showStatus('Login berhasil! Mengalihkan...', true);
            // onAuthStateChanged akan menangani pengalihan
        } catch (error) {
            showError(getFirebaseError(error.code));
        }
    });

    // 2. Tombol Daftar
    signupBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || password.length < 6) {
            showError('Password harus minimal 6 karakter.');
            return;
        }

        try {
            showStatus('Mendaftarkan akun...', false);
            await auth.createUserWithEmailAndPassword(email, password);
            showStatus('Daftar berhasil! Mengalihkan...', true);
            // onAuthStateChanged akan menangani pengalihan
        } catch (error) {
            showError(getFirebaseError(error.code));
        }
    });

    // 3. Tombol Google Sign-In
    googleBtn.addEventListener('click', async () => {
        try {
            showStatus('Membuka popup Google...', false);
            await auth.signInWithPopup(googleProvider);
            showStatus('Login Google berhasil! Mengalihkan...', true);
            // onAuthStateChanged akan menangani pengalihan
        } catch (error) {
            showError(getFirebaseError(error.code));
        }
    });


    // --- Fungsi Bantuan ---

    function showStatus(message, isSuccess) {
        statusMsg.textContent = message;
        statusMsg.className = isSuccess ? 'status-message success' : 'status-message';
    }

    function showError(message) {
        statusMsg.textContent = message;
        statusMsg.className = 'status-message error';
    }

    function getFirebaseError(code) {
        switch (code) {
            case 'auth/wrong-password':
                return 'Password salah. Coba lagi.';
            case 'auth/user-not-found':
                return 'Email tidak terdaftar.';
            case 'auth/email-already-in-use':
                return 'Email ini sudah terdaftar.';
            case 'auth/weak-password':
                return 'Password terlalu lemah.';
            case 'auth/invalid-email':
                return 'Format email tidak valid.';
            default:
                return 'Terjadi kesalahan. Coba lagi nanti.';
        }
    }
});