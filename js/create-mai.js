// File: js/create-mai.js (UPDATE: Auto-Clear Cache)

// Helper untuk mendapatkan token dengan aman
function getAuthTokenSafe() {
    return new Promise((resolve, reject) => {
        if (!firebase.apps.length) return reject(new Error("Firebase belum init"));
        
        const auth = firebase.auth();
        const user = auth.currentUser;

        if (user) {
            user.getIdToken(true).then(resolve).catch(reject);
        } else {
            // Jika user null, tunggu auth state berubah
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe(); // Berhenti memantau
                if (user) {
                    user.getIdToken(true).then(resolve).catch(reject);
                } else {
                    reject(new Error("User tidak login."));
                }
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Elemen DOM ---
    const form = document.getElementById('create-mai-form');
    const imageInput = document.getElementById('mai-image');
    const avatarPreview = document.getElementById('avatar-preview');
    const submitButton = document.getElementById('submit-btn');
    const formStatus = document.getElementById('form-status');

    // --- Cek Status Login ---
    // Pastikan user login sebelum bisa akses halaman ini
    const auth = firebase.auth();
    auth.onAuthStateChanged((user) => {
        if (!user) {
            console.log('User tidak login, mengalihkan...');
            // alert('Anda harus login untuk membuat MAI!'); // Optional, auth-guard sudah menangani
            window.location.href = 'login.html';
        }
    });

    // --- 1. Logika Pratinjau Gambar ---
    avatarPreview.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarPreview.src = e.target.result;
            }
            reader.readAsDataURL(file);
        }
    });

    // --- 2. Logika Submit Formulir ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        let token;
        try {
            token = await getAuthTokenSafe();
        } catch (error) {
            showError('Sesi Anda berakhir. Silakan login kembali.');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Memproses...';
        formStatus.textContent = '';
        formStatus.className = '';

        const file = imageInput.files[0];
        if (!file) {
            showError('Anda harus meng-upload gambar avatar.');
            return;
        }

        try {
            // --- Langkah A: Upload Gambar ke Cloudinary ---
            formStatus.textContent = 'Meng-upload avatar...';
            const fileBase64 = await readFileAsBase64(file);
            
            const uploadResponse = await fetch('/.netlify/functions/upload-image', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ file: fileBase64 })
            });

            if (!uploadResponse.ok) {
                const err = await uploadResponse.json();
                throw new Error(err.error || 'Gagal meng-upload gambar.');
            }

            const uploadData = await uploadResponse.json();
            const imageUrl = uploadData.secure_url; 

            // --- Langkah B: Kumpulkan Data MAI ---
            formStatus.textContent = 'Menyimpan data MAI...';
            
            const maiData = {
                name: document.getElementById('mai-name').value,
                greeting: document.getElementById('mai-greeting').value,
                tagline: document.getElementById('mai-tagline').value,
                description: document.getElementById('mai-description').value,
                tags: document.getElementById('mai-tags').value
                         .split(',')
                         .map(tag => tag.trim())
                         .filter(tag => tag.length > 0),
                visibility: document.querySelector('input[name="visibility"]:checked').value,
                isVnAvailable: document.getElementById('mai-is-vn').checked,
                image: imageUrl
            };
            
            // --- Langkah C: Simpan Data MAI ke Firestore ---
            const saveResponse = await fetch('/.netlify/functions/save-mai', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(maiData)
            });

            if (!saveResponse.ok) {
                const err = await saveResponse.json();
                throw new Error(err.error || 'Gagal menyimpan data MAI ke database.');
            }

            // --- Sukses ---
            
            // ▼▼▼ PERBAIKAN PENTING: Hapus Cache Lobi ▼▼▼
            // Ini memaksa lobi mengambil data terbaru saat kita kembali ke sana
            sessionStorage.removeItem('mai_chars_user'); 
            // ▲▲▲

            formStatus.textContent = 'MAI berhasil dibuat! Mengalihkan ke lobi...';
            formStatus.className = 'success';
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);

        } catch (error) {
            console.error('Error saat membuat MAI:', error);
            showError(error.message);
        }
    });

    // --- Fungsi Bantuan ---

    function showError(message) {
        formStatus.textContent = message;
        formStatus.className = 'error';
        submitButton.disabled = false;
        submitButton.textContent = 'Buat MAI';
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }
});